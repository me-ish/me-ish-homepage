// Test-only font fixture. The product routes/middleware/DB are not replaced.
module.exports=new Proxy({}, {get(){return "@font-face { font-family: 'SyntheticTestFont'; src: local('Arial'); font-style: normal; font-weight: 400; }";}});
