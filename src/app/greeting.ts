/* The home screen's greeting, in the visitor's own time of day ("Up late?"
   after 11pm). The page has the words for each part of the day. */
import { HOURS, partOfDay } from "../shared/page-data.ts";
import { greetings, homeGreeting } from "./page.ts";

/** Greets the visitor by their time of day. A part of the day the page has
    no words for keeps the greeting the page came with. */
export function greet(): void {
  const visitorHour = new Date().getHours();
  const greeting = greetings[partOfDay(visitorHour, HOURS.greeting)];
  if (greeting) homeGreeting.textContent = greeting;
}
