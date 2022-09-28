pragma solidity ^0.8.0;

interface IBase {
    function getWorkInfo(uint _workId) external view returns(string memory _url, uint[] memory nums);
    function fulfillWorkNftInfo(uint _workId,uint _completeNftId) external returns(bool);
    function deleteWorkOfCollect(uint _workId,uint _collectionId) external returns(bool);
    function getCollectLen(uint _collectionId) external view returns(uint);
    function getAllWorkIdsOfCollection(uint _collectionId) external view returns(uint[] memory);
    function getWorkIdsOfCollection(uint _collectionId,uint _startIndex,uint _endIndex) external view returns(uint[] memory);
    function isWorkOfCollection(uint _workId,uint _collectionId) external view returns(bool);
    function getFragNftInfosOfWork(uint _workId,uint _startIndex, uint _endIndex) external view
    returns(bool _canCreate, uint _fragmentNumPerCompNFT,uint[] memory _partialFragNftIds);
    function getUploaderOfCollection(uint _collectionId) external view returns(address);

    function getTotalNftNumOfCollect(uint _collectionId) external view returns(uint);
}

