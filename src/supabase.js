import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://tqfocdktvjuwoiyfgesb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm9jZGt0dmp1d29peWZnZXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NTIsImV4cCI6MjEwNTQ4NDQ1Mn0.8TW4fQCQHc4c_xTNBEwOK3lSC9HYCbkTbfXuYQB-S8g"
);

export function hourSlot(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  x.setMilliseconds(0);
  return x.toISOString();
}

export const HEADLINES = [
  ["The wood remembers", "Leave a mark or keep it in the drawer. Public notes hang until someone takes them down with time."],
  ["Ink before the hour turns", "Write the sentence you have been carrying. If it is public, the wall will hold it."],
  ["A quiet desk, an open wall", "Nothing here is optimized. Notes stay. The board changes when the clock does."],
  ["Second cup, first draft", "Private stays private. Public sits where anyone walking in can read it."],
  ["The hour has its own weather", "Some hours are thin. Some hours fill the tray. Either way the board turns."],
  ["Leave the window cracked", "A public note is a small courtesy to the next person who sits down."]
];
