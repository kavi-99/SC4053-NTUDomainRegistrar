// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NtuDomainRegistrar {
    address private owner;
    uint256 public commitPhaseDuration = 1 minutes;
    uint256 public revealPhaseDuration = 1 minutes;

    struct Bid {
        bytes32 commitment;
        uint256 deposit; // Amount of Ether deposited by the bidder
    }

    struct Auction {
        address highestBidder;
        uint256 highestBid;
        bool finalized;
    }

    enum Phase { None, Commit, Reveal, Finalizing }

    mapping(string => address) public domainOwner;
    mapping(address => string[]) public domainsByOwner;
    mapping(string => mapping(address => Bid)) public bids;
    mapping(string => Auction) public domainAuctions;
    mapping(string => uint256) public biddersCountByDomain;
    mapping(string => Phase) public currentPhase;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(string => address) public secretToAddress;
    mapping(string => bool) public isInCommitPhase; // Track domain commit phase

    string[] public domainsInCommitPhase;
    string[] public registeredDomains;
    uint256 public phaseEndTime;

    event LogBid(address indexed bidder, string domain, uint256 value, string secret);
    event LogCommit(address indexed bidder, string domain, uint256 value, string secret);
    event BidderCountChanged(uint256 newBidderCount);
    event PhaseChanged(Phase phase);
    event DomainWon(address indexed winner, uint256 winningBid, string domain);  // New event to emit winning details
    event Withdrawal(address indexed user, uint256 amount); // New event for withdrawals

    bool private reentrantLock;

    constructor() payable {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier inCommitPhase(string memory domain) {
        require(currentPhase[domain] == Phase.Commit, "Not in commit phase");
        _;
    }

    modifier inRevealPhase(string memory domain) {
        require(currentPhase[domain] == Phase.Reveal, "Not in reveal phase");
        _;
    }

    modifier notFinalized(string memory domain) {
        require(!domainAuctions[domain].finalized, "Domain has already been auctioned off");
        _;
    }

    modifier nonReentrant() {
        require(!reentrantLock, "Reentrancy detected!");
        reentrantLock = true;
        _;
        reentrantLock = false;
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function initializeDomainPhase(string memory domain) internal {
        currentPhase[domain] = Phase.None;
    }

    function retrieveDomainPhase(string memory domain) public view returns (string memory) {
        Phase phase = currentPhase[domain];
        return phaseToString(phase);
    }

    function phaseToString(Phase phase) internal pure returns (string memory) {
        if (phase == Phase.None) return "None";
        else if (phase == Phase.Commit) return "Commit";
        else if (phase == Phase.Reveal) return "Reveal";
        else if (phase == Phase.Finalizing) return "Finalizing";
        return "Unknown";     
    }

    function startCommitPhase(string memory domain) external notFinalized(domain) {
        currentPhase[domain] = Phase.Commit;
        phaseEndTime = block.timestamp + commitPhaseDuration;
        isInCommitPhase[domain] = true; // Mark domain as in commit phase
        domainsInCommitPhase.push(domain); // Track domain in commit phase
        emit PhaseChanged(currentPhase[domain]);
    }

    function commitBid(string memory domain, uint256 value, string memory secret) public payable {
        require(isInCommitPhase[domain], "Domain not in commit phase");
        require(msg.value >= 0, "Bid deposit must include Ether");
        require(secretToAddress[secret] == address(0), "Secret has already been used");

        // Log the address that used this secret
        secretToAddress[secret] = msg.sender;

        bytes32 commitment = keccak256(abi.encodePacked(msg.sender, value, secret));
        require(bids[domain][msg.sender].commitment == 0, "Bid already made");

        bids[domain][msg.sender] = Bid({
            commitment: commitment,
            deposit: msg.value
        });

        biddersCountByDomain[domain]++;
        emit BidderCountChanged(biddersCountByDomain[domain]);
        emit LogBid(msg.sender, domain, value, secret);
    }

    function startRevealPhase(string memory domain) external {
        require(block.timestamp > phaseEndTime, "Commit phase not over");
        require(currentPhase[domain] == Phase.Commit, "Cannot start reveal phase now");
        currentPhase[domain] = Phase.Reveal;
        emit PhaseChanged(currentPhase[domain]);
    }

    function revealBid(string memory domain, uint256 value, string memory secret) external inRevealPhase(domain) {
        bytes32 commitment = keccak256(abi.encodePacked(msg.sender, value, secret));
        require(bids[domain][msg.sender].commitment == commitment, "Invalid reveal");

        if (value > domainAuctions[domain].highestBid) {
            if (domainAuctions[domain].highestBidder != address(0)) {
                pendingWithdrawals[domainAuctions[domain].highestBidder] += domainAuctions[domain].highestBid;
            }

            domainAuctions[domain].highestBidder = msg.sender;
            domainAuctions[domain].highestBid = value;
        } else {
            // Add the actual deposit to pending withdrawals for losing bidders
            pendingWithdrawals[msg.sender] += bids[domain][msg.sender].deposit; 
        }
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount); // Emit withdrawal event
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function finalizeAuction(string memory domain) external inRevealPhase(domain) {
        require(!domainAuctions[domain].finalized, "Auction already finalized");

        domainOwner[domain] = domainAuctions[domain].highestBidder;
        domainsByOwner[domainAuctions[domain].highestBidder].push(domain);
        domainAuctions[domain].finalized = true;

        registeredDomains.push(domain);
        currentPhase[domain] = Phase.Finalizing;
        isInCommitPhase[domain] = false; // Reset commit phase status
        emit PhaseChanged(currentPhase[domain]);
        emit DomainWon(domainAuctions[domain].highestBidder, domainAuctions[domain].highestBid, domain);  // Emit winning details
    }

    function getRegisteredDomains() external view returns (string[] memory) {
        return registeredDomains;
    }

    function fetchHighestBid(string memory domain) public view returns (address, uint256) {
        Auction storage auction = domainAuctions[domain];
        return (auction.highestBidder, auction.highestBid);
    }

    function resolveDomainToAddress(string memory domain) external view returns (address) {
        return domainOwner[domain];
    }

    function resolveAddressToDomains(address Owner) external view returns (string[] memory) {
        return domainsByOwner[Owner];
    }

    function getBiddersCountByDomain(string memory domain) public view returns (uint256 count) {
        return biddersCountByDomain[domain]; 
    }

    function getDomainsInCommitPhase() external view returns (string[] memory) {
        return domainsInCommitPhase;
    }

    // New function to fetch the winning address
    function getWinner(string memory domain) external view returns (address) {
        return domainAuctions[domain].highestBidder;
    }
}