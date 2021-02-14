import SSC from 'sscjs';
console.log(process.env);
console.log('url:'+process.env.REACT_APP_RPC_URL);
export const ssc = new SSC(process.env.REACT_APP_RPC_URL);