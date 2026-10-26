const net=require('node:net');
net.Socket.prototype.connect=function(){throw new Error('Fixture build forbids network connections');};
