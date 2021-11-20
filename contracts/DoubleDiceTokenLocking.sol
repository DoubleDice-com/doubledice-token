// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DoubleDiceTokenLocking is Ownable {

    using SafeERC20 for IERC20;

    IERC20 public token;

    uint256 public minLockDuration = 90 days;
    uint256 public minLockAmount;
    uint16 public constant MAX_LOCK_AMOUNT_TOPUP_MULTIPLIER = 6;

    struct LockedAsset {
        uint256 amount;
        uint256 startTime;
        uint256 expiryTime;
        bool    claimed;
    }

    struct UserInfo {
        bytes32 lockId;
        uint256 initialAmount;
        uint256 updatedAmount;
        bool    isWhitelisted; 
        bool    hasReservedLock; 
    }

    mapping(address => mapping(bytes32 => LockedAsset)) public lockedAsset;
    mapping(address => UserInfo) public userInfo;
    mapping(bytes32 => address) public addressLockId;
    
    event Claim(
        bytes32 indexed lockId, 
        address indexed beneficiary
    );
    
    event Lock(
        bytes32 indexed lockId, 
        address indexed beneficiary, 
        uint256 amount,
        uint256 startTime,
        uint256 expiryTime,
        bool    isVested
    );    
    
    event TopupVestingBasedLock(
        bytes32 indexed lockId, 
        address indexed sender, 
        uint256 amount
    );    
    
    event UpdateLockExpiry(
        bytes32 indexed lockId, 
        address indexed sender, 
        uint256 oldExpiryTime,
        uint256 newExpiryTime
    );
    
    modifier onlyLockOwner(bytes32 lockId) {
        require(lockedAsset[msg.sender][lockId].expiryTime != 0, "LockId does not belong to sender");
        _;
    }   
    
    constructor(
        address tokenAddress,
        uint256 minLockAmount_
    ) {
        require(tokenAddress != address(0), "Not a valid token address");
        token = IERC20(tokenAddress);
        minLockAmount = minLockAmount_;
    }

    function createLock(uint256 amount, uint256 expiryTime) external {
        require(expiryTime != 0, "Expiry must not be equal to zero");
        require(expiryTime >= (block.timestamp + minLockDuration), "Expiry time is too low");
        
        require(amount >= minLockAmount, "Token amount is too low");
        
        bytes32 nextLockId = keccak256(abi.encode(amount, expiryTime, msg.sender, block.timestamp));

        require(addressLockId[nextLockId] == address(0), "User with this lock id already created");
        
        addressLockId[nextLockId] = msg.sender;

        lockedAsset[msg.sender][nextLockId] = LockedAsset({
            amount: amount,
            startTime: block.timestamp,
            expiryTime: expiryTime,
            claimed: false
        });
        token.transferFrom(msg.sender, address(this), amount);
        emit Lock(nextLockId, msg.sender, amount, block.timestamp, expiryTime, false);
        
    }

    function createVestingBasedLock(uint256 amount, uint256 expiryTime) external {
        
        require(expiryTime != 0, "Expiry must not be equal to zero");
        require(expiryTime >= (block.timestamp + minLockDuration), "Expiry time is too low");
        require(amount >= minLockAmount, "Token amount is too low");
        require(userInfo[msg.sender].isWhitelisted, "Sender is not whitelisted");
        require(!userInfo[msg.sender].hasReservedLock, "Sender already have a reserved lock");

        bytes32 nextLockId = keccak256(abi.encode(amount, expiryTime, msg.sender, block.timestamp));
        require(addressLockId[nextLockId] == address(0), "User with this lock id already created");
        
        userInfo[msg.sender].lockId = nextLockId;
        userInfo[msg.sender].hasReservedLock = true;
        addressLockId[nextLockId] = msg.sender;
            
        userInfo[msg.sender].initialAmount = amount;
        userInfo[msg.sender].updatedAmount = amount;

        lockedAsset[msg.sender][nextLockId] = LockedAsset({
            amount: amount,
            startTime: block.timestamp,
            expiryTime: expiryTime,
            claimed: false
        });

       token.transferFrom(msg.sender, address(this), amount);

       emit Lock(
           nextLockId, 
           msg.sender, 
           amount, 
           block.timestamp, 
           expiryTime,
           true
       );
        
    }

    function topupVestingBasedLock(bytes32 lockId, uint256 amount) external onlyLockOwner(lockId) {
        UserInfo storage _userInfo = userInfo[msg.sender];
        require(_userInfo.lockId == lockId, "Invalid Lock id");
        require(_userInfo.hasReservedLock, "Sender does not have a reserved lock");
        require((MAX_LOCK_AMOUNT_TOPUP_MULTIPLIER * _userInfo.initialAmount) >= (_userInfo.updatedAmount + amount), "Amount exceed the reserved amount");

       _userInfo.updatedAmount = _userInfo.updatedAmount + amount;
       lockedAsset[msg.sender][lockId].amount = lockedAsset[msg.sender][lockId].amount + amount;

       token.transferFrom(msg.sender, address(this), amount);

       emit TopupVestingBasedLock(
           lockId, 
           msg.sender, 
           amount
       );
        
    }


    function claim(bytes32 lockId) external onlyLockOwner(lockId) {
        
        LockedAsset storage _lockedAsset = lockedAsset[msg.sender][lockId];
        
        require(block.timestamp >= _lockedAsset.expiryTime, "Asset have not expired");
        require(!_lockedAsset.claimed, "Asset have already been claimed");
        
        _lockedAsset.claimed = true;
        
        token.transfer(msg.sender, _lockedAsset.amount);
        
        emit Claim(
            lockId,
            msg.sender
        );
        
    }

    function updateLockExpiry(bytes32 lockId, uint256 newExpiryTime) external onlyLockOwner(lockId) {
        LockedAsset storage _lockedAsset = lockedAsset[msg.sender][lockId];
        uint256 oldExpiryTime = _lockedAsset.expiryTime;
        
        require(!_lockedAsset.claimed, "Asset have already been claimed");
        require(newExpiryTime > oldExpiryTime, "Low new expiry date");
        
        _lockedAsset.expiryTime = newExpiryTime;
        
        emit UpdateLockExpiry(
            lockId, 
            msg.sender, 
            oldExpiryTime,
            newExpiryTime
        );
        
    }
    
    function addToWhiteList(address user) external onlyOwner {
        userInfo[user].isWhitelisted = true;
    }    

    function updateMinLockDuration(uint256 newLockDuration) external onlyOwner {
        minLockDuration = newLockDuration;
    }

    function updateMinLockAmount(uint256 newMinLockAmount) external onlyOwner {
        minLockAmount = newMinLockAmount;
    }

    function getAddressLockIds(bytes32 lockId) external view returns(address) {
        return addressLockId[lockId];
    }

    function getLockDetails(address user, bytes32 lockId) external view returns(LockedAsset memory) {
        return lockedAsset[user][lockId];
    }
    
    function getUserInfo(address user) external view returns(UserInfo memory) {
        return userInfo[user];
    }
    
    

}



