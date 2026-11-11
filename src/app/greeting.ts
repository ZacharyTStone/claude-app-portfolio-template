/* The home screen's greeting, in the visitor's own time of day ("Up late?"
   after 11pm). The page has the words for each part of the day. */
import { HOURS, partOfDay } from "../shared/page-data.ts";
import { greetings, hello } from "./page.ts";

export function greet(): void {
  const greeting = greetings[partOfDay(new Date().getHours(), HOURS.greeting)];
  if (greeting) hello.textContent = greeting;
}
