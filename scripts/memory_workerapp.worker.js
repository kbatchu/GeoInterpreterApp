/******/ (() => { // webpackBootstrap
/*!******************************************!*\
  !*** ./scripts/modules/memory_worker.js ***!
  \******************************************/
// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\modules\memory_worker.js

console.log("Memory Worker: Hello from the worker!");

self.onmessage = (event) => {
  const { messageId, command, args } = event.data;
  
  try {
    switch (command) {
      case 'initialize':
        console.log("Memory Worker: Initializing...");
        self.postMessage({ messageId, payload: 'initialized' });
        break;
      
      case 'generateEmbedding':
        console.log("Memory Worker: Generating embedding for:", args.text);
        // Placeholder - return empty array for now
        self.postMessage({ messageId, payload: [] });
        break;
        
      case 'query':
        console.log("Memory Worker: Executing query:", args.sql);
        // Placeholder - return empty array for now
        self.postMessage({ messageId, payload: [] });
        break;
        
      case 'getRelevantTools':
        console.log("Memory Worker: Getting relevant tools for:", args.query);
        // Placeholder - return empty array for now
        self.postMessage({ messageId, payload: [] });
        break;
        
      case 'addConversationTurn':
        console.log("Memory Worker: Adding conversation turn:", args.turn);
        // Placeholder - just acknowledge
        self.postMessage({ messageId, payload: 'turn added' });
        break;
      
      default:
        self.postMessage({ 
          messageId, 
          error: `Unknown command: ${command}` 
        });
    }
  } catch (error) {
    console.error("Memory Worker: Error processing command:", error);
    self.postMessage({ 
      messageId, 
      error: error.message 
    });
  }
};

self.onerror = (error) => {
  console.error("Memory Worker: Global error:", error);
};

console.log("Memory Worker: Ready to receive messages");
/******/ })()
;
//# sourceMappingURL=memory_workerapp.worker.js.map