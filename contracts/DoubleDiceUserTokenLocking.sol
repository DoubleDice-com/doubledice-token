// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DoubleDiceUserTokenLocking is Ownable, ReentrancyGuard {

  using SafeERC20 for IERC20;

  IERC20 public token;

  uint256 public minLockDuration = 365 days;
  uint256 public minLockAmount = 1e18;

  struct UserLock {
    uint256 amount;
    uint256 startTime;
    uint256 expiryTime;
    bool    hasLock;
    bool    claimed;
  }

  mapping(address => UserLock) public userLock;

  event Claim(
    address indexed user,
    uint256 amount 
  );
  
  event UserLockInfo(
    address indexed user, 
    uint256 amount,
    uint256 startTime,
    uint256 expiryTime
  );    
  
  event TopUpLock(
    address indexed user, 
    uint256 amount,
    uint256 depositTime
  );    

  event UpdateLockExpiry(
    address indexed user, 
    uint256 oldExpiryTime,
    uint256 newExpiryTime
  );
  
  constructor(address tokenAddress, uint256 minLockAmount_) {
    require(tokenAddress != address(0), "Not a valid token address");
    require(minLockAmount_ != 0, "Minimum lock amount must not be equal to zero");

    token = IERC20(tokenAddress);
    minLockAmount = minLockAmount_;
  }

  function createLock(uint256 amount, uint256 expiryTime) external {
    require(expiryTime != 0, "Expiry can not be equal to zero");
    require(expiryTime >= (block.timestamp + minLockDuration), "Expiry time is too low");
    require(amount >= minLockAmount, "Token amount is too low");
    require(!userLock[msg.sender].hasLock, "User already created a lock");

    userLock[msg.sender] = UserLock({
      amount: amount,
      startTime: block.timestamp,
      expiryTime: expiryTime,
      hasLock: true,
      claimed: false
    });
    
    token.transferFrom(msg.sender, address(this), amount);

    emit UserLockInfo(msg.sender, amount, block.timestamp, expiryTime);
  }


  function topUpLock(uint256 amount) external {
    UserLock storage user = userLock[msg.sender];
    require(amount > 0, "Top up amount must be greater than zero");
    require(user.hasLock, "User have not created a lock");

    user.amount = user.amount + amount;
    
    token.transferFrom(msg.sender, address(this), amount);

    emit TopUpLock(msg.sender, amount, block.timestamp);
  }


  function claim() external nonReentrant {
      
    UserLock storage user = userLock[msg.sender];
    
    require(block.timestamp >= user.expiryTime, "Asset have not expired");
    require(!user.claimed, "Asset have already been claimed");
    
    user.claimed = true;
    
    token.transfer(msg.sender, user.amount);
    
    emit Claim(msg.sender,user.amount);
  }

  function updateLockExpiry(uint256 newExpiryTime) external {
    UserLock storage user = userLock[msg.sender];
    uint256 oldExpiryTime = user.expiryTime;
    
    require(!user.claimed, "Asset have already been claimed");
    require(user.hasLock, "User have not created a lock");
    require(newExpiryTime > oldExpiryTime, "Low new expiry date");
    
    user.expiryTime = newExpiryTime;
    
    emit UpdateLockExpiry(msg.sender, oldExpiryTime, newExpiryTime);
  }
  
  function updateMinLockDuration(uint256 newLockDuration) external onlyOwner {
    require(newLockDuration != 0, "New lock duration can not be equal to zero");
    minLockDuration = newLockDuration;
  }

  function updateMinLockAmount(uint256 newMinLockAmount) external onlyOwner {
    require(newMinLockAmount != 0, "New lock amount can not be equal to zero");
    minLockAmount = newMinLockAmount;
  }

  function getUserLockInfo(address user) external view returns(UserLock memory) {
    return userLock[user];
  }
    
}



