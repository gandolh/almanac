// The feature's public surface: `app.ts` registers the routes and builds the store from here,
// and the calendar, occurrence, search, reminder and feed features use the rest.
export { expandSeries, isSeries, rowOccurrence, searchOccurrence, seriesRepeats } from "./expand.js";
export { eventRoutes } from "./routes.js";
export { removeCalendar } from "./service.js";
export { createEventStore, type EventRange, type EventRecord, type EventStore, type NewEvent } from "./store.js";
