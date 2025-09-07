import * as duckdb from "@duckdb/duckdb-wasm";

async function initDuckDB() {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      })
    );
    // Instantiate the asynchronus version of DuckDB-Wasm
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    console.log(await db.getVersion());
    const dbConn = await db.connect();

    try {
      await dbConn.query("INSTALL spatial;"); // Install spatial extension
      await dbConn.query("LOAD spatial;"); // Load spatial extension
      console.log("DuckDB Spatial extension loaded."); // Log success
    } catch (e) {
      console.warn(
        "Could not load DuckDB Spatial extension (it might already be loaded or not available):",
        e
      );
    }

    try {
      await dbConn.query("INSTALL vss;");
      await dbConn.query("LOAD vss;");      
      console.log("DuckDB VSS extension loaded and updated.");
    } catch (e) {
      console.error(
        "CRITICAL: Could not load DuckDB VSS extension. Vector similarity search will not work.",
        e
      );
      throw e; // Re-throw to halt initialization if VSS is unavailable
    }

    try {
      // Load the toolregistry.duckdb database
      const response = await fetch("../../data/toolregistry.duckdb");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch toolregistry.duckdb: ${response.statusText}`
        );
      }
      const toolRegistryDBBuffer = await response.arrayBuffer(); // Get as ArrayBuffer
      await db.registerFileBuffer(
        "toolregistry.duckdb",
        new Uint8Array(toolRegistryDBBuffer)
      );
      await dbConn.query(
        `ATTACH 'toolregistry.duckdb' AS tool_registry_db (READ_ONLY);`
      );
      console.log("Successfully loaded and attached toolregistry.duckdb");
    } catch (e) {
      console.warn("Could not load toolregistry.duckdb database:", e);
    }

    return { db, dbConn };
}
export default initDuckDB;
