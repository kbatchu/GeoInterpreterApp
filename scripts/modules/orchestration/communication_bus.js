// c:\Kiran\Work\GIS\DATAVIZ\GeoInterpreter\scripts\orchestration\communication_bus.js
class CommunicationBus extends EventTarget {
  constructor() {
    super();
  }

  /**
   * Dispatches a custom event with optional detail.
   * @param {string} eventName - The name of the event.
   * @param {object} [detail={}] - Optional data to pass with the event.
   */
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    super.dispatchEvent(event);
    // console.log(`CommunicationBus: Dispatched event '${eventName}'`, detail);
  }

  /**
   * Adds an event listener for a custom event.
   * @param {string} eventName - The name of the event.
   * @param {function} callback - The callback function to execute when the event is dispatched.
   */
  addEventListener(eventName, callback) {
    super.addEventListener(eventName, callback);
    // console.log(`CommunicationBus: Added listener for event '${eventName}'`);
  }

  /**
   * Removes an event listener for a custom event.
   * @param {string} eventName - The name of the event.
   * @param {function} callback - The callback function to remove.
   */
  removeEventListener(eventName, callback) {
    super.removeEventListener(eventName, callback);
    // console.log(`CommunicationBus: Removed listener for event '${eventName}'`);
  }
}

export default CommunicationBus;
