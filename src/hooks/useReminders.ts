import { useEffect, useState } from "react";
import { subscribeReminders } from "../services/data";
import type { Reminder } from "../types";

export function useReminders(uid?: string) {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    if (!uid) return;
    return subscribeReminders(uid, setReminders);
  }, [uid]);

  return reminders;
}
