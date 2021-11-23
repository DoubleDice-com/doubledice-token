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

    struct UserVestedBaseLockInfo {
        bytes32 lockId;
        uint256 initialAmount;
        uint256 updatedAmount;
        bool    isWhitelisted; 
        bool    hasReservedLock; 
    }

    mapping(address => mapping(bytes32 => LockedAsset)) public lockedAsset;
    mapping(address => UserVestedBaseLockInfo) public userVestedBaseLockInfo;
    mapping(bytes32 => address) public lockIdOwners;
    
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
        require(minLockAmount_ != 0, "Minimum lock amount must not be equal to zero");
        token = IERC20(tokenAddress);
        minLockAmount = minLockAmount_;
    }

    function createLock(uint256 amount, uint256 expiryTime) external {
        require(expiryTime != 0, "Expiry must not be equal to zero");
        require(expiryTime >= (block.timestamp + minLockDuration), "Expiry time is too low");
        
        require(amount >= minLockAmount, "Token amount is too low");
        
        bytes32 nextLockId = keccak256(abi.encode(amount, expiryTime, msg.sender, block.timestamp));

        require(lockIdOwners[nextLockId] == address(0), "User with this lock id already created");
        
        lockIdOwners[nextLockId] = msg.sender;

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
        require(userVestedBaseLockInfo[msg.sender].isWhitelisted, "Sender is not whitelisted");
        require(!userVestedBaseLockInfo[msg.sender].hasReservedLock, "Sender already have a reserved lock");

        bytes32 nextLockId = keccak256(abi.encode(amount, expiryTime, msg.sender, block.timestamp));
        require(lockIdOwners[nextLockId] == address(0), "User with this lock id already created");
        
        userVestedBaseLockInfo[msg.sender].lockId = nextLockId;
        userVestedBaseLockInfo[msg.sender].hasReservedLock = true;
        lockIdOwners[nextLockId] = msg.sender;
            
        userVestedBaseLockInfo[msg.sender].initialAmount = amount;
        userVestedBaseLockInfo[msg.sender].updatedAmount = amount;

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
        UserVestedBaseLockInfo storage _userVestedBaseLockInfo = userVestedBaseLockInfo[msg.sender];
        require(_userVestedBaseLockInfo.lockId == lockId, "Invalid Lock id");
        require(_userVestedBaseLockInfo.hasReservedLock, "Sender does not have a reserved lock");
        require((MAX_LOCK_AMOUNT_TOPUP_MULTIPLIER * _userVestedBaseLockInfo.initialAmount) >= (_userVestedBaseLockInfo.updatedAmount + amount), "Amount exceed the reserved amount");

       _userVestedBaseLockInfo.updatedAmount = _userVestedBaseLockInfo.updatedAmount + amount;
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
        require(!userVestedBaseLockInfo[user].isWhitelisted, "User already whitelisted");
        userVestedBaseLockInfo[user].isWhitelisted = true;
    }    

    function updateMinLockDuration(uint256 newLockDuration) external onlyOwner {
        require(newLockDuration != 0, "New lock duration can not be equal to zero");
        minLockDuration = newLockDuration;
    }

    function updateMinLockAmount(uint256 newMinLockAmount) external onlyOwner {
        require(newMinLockAmount != 0, "New lock amount can not be equal to zero");
        minLockAmount = newMinLockAmount;
    }

    function getlockIdOwners(bytes32 lockId) external view returns(address) {
        return lockIdOwners[lockId];
    }

    function getLockDetails(address user, bytes32 lockId) external view returns(LockedAsset memory) {
        return lockedAsset[user][lockId];
    }
    
    function getUserVestedBaseLockInfo(address user) external view returns(UserVestedBaseLockInfo memory) {
        return userVestedBaseLockInfo[user];
    }
    
    

}



