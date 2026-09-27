// Where the dashboard goes once the channel-connect screen is finished. Pure
// (no imports), so tests/t-connect-flow.mjs can hold it to its promises.
//
// The same screen serves two trips:
//   · signup — the new owner connects a first channel, and a service business
//     (agency) is then asked for Google Calendar, which is how its bot books
//     meetings; a shop has nothing to book, so it goes straight in;
//   · the Channels tab — an owner who is already set up adds or reconnects a
//     Page, account or number, and must land back on that tab.
// Owner's report, 2026-09-28: connecting a channel from the Channels tab ended
// on "Connect Google Calendar", because the screen always ran the signup trip.
// A calendar that is already connected is never asked for again either way.
export function afterChannelConnect({ fromApp = false, businessType = "", calendarConnected = false } = {}) {
  if (!fromApp && businessType === "agency" && !calendarConnected) return "connect-cal";
  return "app";
}
