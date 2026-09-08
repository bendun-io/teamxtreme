// Mirrors the earliest/latest flight convention used across HomePage.jsx and
// CalendarPage.jsx: a user's earliest flight (by departure time) is treated
// as their outbound trip (arrival at the destination) and their latest as
// their return trip (departure from the destination) — the same flight
// fills both roles if it's the only one on file.
export function getUserTravelDates(userId, flights) {
  const userFlights = flights.filter((f) => f.userId === userId);
  if (userFlights.length === 0) return { arrival: null, departure: null };

  const sorted = [...userFlights].sort(
    (a, b) => new Date(a.departureTime) - new Date(b.departureTime)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    arrival: first.arrivalTime ? new Date(first.arrivalTime) : null,
    departure: sorted.length > 1 ? new Date(last.departureTime) : null,
  };
}
