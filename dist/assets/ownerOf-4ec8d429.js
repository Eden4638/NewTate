import{cE as o,U as c,j as a,r as d}from"./index-a005ad49.js";const t="0x6352211e",n=[{type:"uint256",name:"tokenId"}],r=[{type:"address"}];function f(e){return o({availableSelectors:e,method:[t,n,r]})}function s(e){return c(n,[e.tokenId])}function O(e){return t+s(e).slice(2)}function i(e){return a(r,e)[0]}async function m(e){return d({contract:e.contract,method:[t,n,r],params:[e.tokenId]})}export{t as FN_SELECTOR,i as decodeOwnerOfResult,O as encodeOwnerOf,s as encodeOwnerOfParams,f as isOwnerOfSupported,m as ownerOf};
