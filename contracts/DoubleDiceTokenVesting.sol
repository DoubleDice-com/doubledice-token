// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./IDoubleDiceToken.sol";


contract DoubleDiceTokenVesting is OwnableUpgradeable {
    using SafeCast for uint256;
    using SafeERC20 for IERC20;

    IDoubleDiceToken public token;
    address public tokenAddress;

    uint constant internal SECONDS_PER_MONTH = 2628000;

    event GrantAdded(uint256 startTime, uint256 amount, uint32 vestingDuration, uint32 vestingCliff);
    event GrantRemoved(uint256 amountVested, uint256 amountNotVested);
    event GrantTokensClaimed(uint256 amountClaimed);
    event InitialGrantTokensClaimed(uint256 amountClaimed);
    event YieldCollected(address userAddress, uint256 amountCollected);
    event TokensClaimed(uint256 amountUserClaim);


    struct Grant {
        uint256 startTime;
        uint32 vestingDuration;
        uint32 vestingCliff;
        uint32 monthsClaimed;
        uint256 amount;
        uint256 totalClaimed;
        uint256 initiallyClaimableAmount;
        bool initialClaimableCollected;
    }

    Grant public tokenGrant;
    address public userAddress;

    modifier nonZeroAddress(address x) {
        require(x != address(0), "token-zero-address");
        _;
    }

    modifier onlyUser {
        require(_msgSender() == userAddress, "only-user-is-authorized");
        _;
    }

    function initialize(
        address _tokenAddress, address _userAddress,
        uint256 _startTime, uint256 _amount, uint32 _vestingDuration, uint32 _vestingCliff, uint256 _initiallyClaimableAmount
    )
    external
    initializer
    nonZeroAddress(_tokenAddress)
    {
        __Ownable_init();

        tokenAddress = _tokenAddress;
        userAddress = _userAddress;
        token = IDoubleDiceToken(tokenAddress);

        require(_vestingCliff > 0, "zero-vesting-cliff");
        require(_vestingDuration > _vestingCliff, "cliff-longer-than-duration");
        require(_initiallyClaimableAmount < _amount, "Initial claimable should be less than the total amount");
        uint amountVestedPerMonth = (_amount - _initiallyClaimableAmount) / _vestingDuration;
        require(amountVestedPerMonth > 0, "zero-amount-vested-per-month");

        tokenGrant.startTime = _startTime == 0 ? currentTime() : _startTime;
        tokenGrant.amount = _amount;
        tokenGrant.vestingDuration = _vestingDuration;
        tokenGrant.vestingCliff = _vestingCliff;
        tokenGrant.monthsClaimed = 0;
        tokenGrant.totalClaimed = 0;
        tokenGrant.initiallyClaimableAmount = _initiallyClaimableAmount;
        tokenGrant.initialClaimableCollected = false;

        // Transfer the grant tokens under the control of the vesting contract
        token.transferFrom(owner(), address(this), _amount);

        emit GrantAdded(tokenGrant.startTime, _amount, _vestingDuration, _vestingCliff);
    }

    /// @notice Terminate token grant transferring all vested tokens to the `_userAddress`
    /// and returning all non-vested tokens to the DODI owner
    function removeTokenGrant() external
    onlyOwner
    {
        uint32 monthsVested;
        uint256 amountVested;
        uint256 amountUserDeserve;
        (monthsVested, amountVested) = calculateGrantClaim();
        uint256 amountNotVested = tokenGrant.amount - tokenGrant.totalClaimed - amountVested - tokenGrant.initiallyClaimableAmount;

        amountUserDeserve += amountVested;

        // Collecting yield of the contract
        token.claimYield();

        // Any yield should be paid out for the user
        uint256 amountVestedTokensWithYield = IERC20(token).balanceOf(address(this));
        uint256 tokenGrantAmountToBeClaimed = tokenGrant.amount - tokenGrant.totalClaimed;
        if(amountVestedTokensWithYield > tokenGrantAmountToBeClaimed) {
            amountUserDeserve += (amountVestedTokensWithYield - tokenGrantAmountToBeClaimed);
        }

        if(!tokenGrant.initialClaimableCollected && (currentTime() > tokenGrant.startTime )) {
            amountUserDeserve += tokenGrant.initiallyClaimableAmount;
        }

        tokenGrant.startTime = 0;
        tokenGrant.amount = 0;
        tokenGrant.vestingDuration = 0;
        tokenGrant.vestingCliff = 0;
        tokenGrant.monthsClaimed = 0;
        tokenGrant.totalClaimed = 0;
        tokenGrant.initiallyClaimableAmount = 0;

        token.transfer(userAddress, amountUserDeserve);
        token.transfer(owner(), amountNotVested);

        emit GrantRemoved(amountVested, amountNotVested);
    }

    /// @notice Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested
    /// It is advised recipients check they are entitled to claim via `calculateGrantClaim` before calling this
    function claimVestedTokens() external onlyUser {
        uint32 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim();
        require(amountVested > 0, "token-zero-amount-vested");

        tokenGrant.monthsClaimed = tokenGrant.monthsClaimed + monthsVested;
        tokenGrant.totalClaimed = tokenGrant.totalClaimed + amountVested;

        token.transfer(userAddress, amountVested);
        emit GrantTokensClaimed(amountVested);
    }

    function collectInitiallyClaimableAmount() external onlyUser {
        require(tokenGrant.initiallyClaimableAmount > 0, "Initially claimable should be greater than zero");
        require(!tokenGrant.initialClaimableCollected, "Initial claimable already collected");
        require(currentTime() > tokenGrant.startTime, "Initial claimable not claimable before token grant start time");

        tokenGrant.initialClaimableCollected = true;
        tokenGrant.totalClaimed = tokenGrant.totalClaimed + tokenGrant.initiallyClaimableAmount;



        token.transfer(userAddress, tokenGrant.initiallyClaimableAmount);

        emit InitialGrantTokensClaimed(tokenGrant.initiallyClaimableAmount);
    }

    function claim() external onlyUser {
        uint256 amountUserClaim;

        // Collecting yield of the contract
        token.claimYield();

        // Any yield should be paid out for the user
        uint256 amountVestedTokensWithYield = IERC20(token).balanceOf(address(this));
        uint256 tokenGrantAmountToBeClaimed = tokenGrant.amount - tokenGrant.totalClaimed;
        if(amountVestedTokensWithYield > tokenGrantAmountToBeClaimed) {
            amountUserClaim += (amountVestedTokensWithYield - tokenGrantAmountToBeClaimed);
        }

        uint32 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim();

        if(amountVested > 0) {
            tokenGrant.monthsClaimed = tokenGrant.monthsClaimed + monthsVested;
            amountUserClaim += amountVested;
            tokenGrant.totalClaimed += amountVested;
        }

        if(!tokenGrant.initialClaimableCollected && (currentTime() > tokenGrant.startTime )) {
            amountUserClaim += tokenGrant.initiallyClaimableAmount;
            tokenGrant.initialClaimableCollected = true;
            tokenGrant.totalClaimed += tokenGrant.initiallyClaimableAmount;
        }

        require(amountUserClaim > 0, "zero claims");
        require(amountUserClaim <= amountVestedTokensWithYield, "cannot claim more than token grant and yield");
        token.transfer(userAddress, amountUserClaim);

        emit TokensClaimed(amountUserClaim);
    }

    function getClaimableAmount() external view returns (uint256) {
        uint256 amountUserClaim;

        uint32 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim();
        amountUserClaim += amountVested;

        if(!tokenGrant.initialClaimableCollected && (currentTime() > tokenGrant.startTime )) {
            amountUserClaim += tokenGrant.initiallyClaimableAmount;
        }

        return amountUserClaim;
    }



    function calculateGrantClaim() public view returns (uint32, uint256) {

        // For grants created with a future start date, that hasn't been reached, return 0, 0
        if (currentTime() < tokenGrant.startTime) {
            return (0, 0);
        }

        // Check cliff was reached
        uint elapsedTime = currentTime() - tokenGrant.startTime;
        uint elapsedMonths = elapsedTime / SECONDS_PER_MONTH;

        if (elapsedMonths < tokenGrant.vestingCliff) {
            return (0, 0);
        }

        // If over vesting duration, all tokens vested
        if (elapsedMonths >= tokenGrant.vestingDuration) {
            uint256 remainingGrant = tokenGrant.amount - tokenGrant.totalClaimed;

            if (!tokenGrant.initialClaimableCollected) {
                remainingGrant = remainingGrant - tokenGrant.initiallyClaimableAmount;
            }

            return (tokenGrant.vestingDuration, remainingGrant);
        } else {
            uint32 monthsVested = uint32(elapsedMonths - tokenGrant.monthsClaimed);
            uint amountVestedPerMonth = (tokenGrant.amount - tokenGrant.initiallyClaimableAmount) / tokenGrant.vestingDuration;
            uint256 amountVested = uint256(monthsVested * amountVestedPerMonth);
            return (monthsVested, amountVested);
        }
    }

    function collectYield() external onlyUser {
        uint256 tokenGrantAmountToBeClaimed = tokenGrant.amount - tokenGrant.totalClaimed;

        // Collecting yield of the contract
        token.claimYield();

        uint256 amountYield = IERC20(token).balanceOf(address(this));
        require(amountYield > tokenGrantAmountToBeClaimed, "zero yield profit");

        token.transfer(userAddress, amountYield - tokenGrantAmountToBeClaimed);

        emit YieldCollected(userAddress, amountYield - tokenGrantAmountToBeClaimed);
    }

    function currentTime() public view returns (uint256) {
        return block.timestamp;
    }
}
