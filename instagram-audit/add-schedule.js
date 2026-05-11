/**
 * One-time helper to seed Lane's schedule for the week of 5/11/2026.
 * Uses the existing addScheduleEntry function in sheets.js.
 *
 * Run with: node add-schedule.js
 */

require('dotenv').config({ override: true });
const { addScheduleEntry } = require('./sheets');
const { log, error } = require('./utils/logger');

const entries = [
  { date: '2026-05-11', time: '9:00 AM',  task: 'Lisa @ clinic',                 type: 'Clinic',   notes: '' },
  { date: '2026-05-11', time: '3:00 PM',  task: 'Mike — pickleball lesson',      type: 'Lesson',   notes: '' },
  { date: '2026-05-12', time: '2:00 PM',  task: 'Carla @ clinic',                type: 'Clinic',   notes: '' },
  { date: '2026-05-12', time: '5:00 PM',  task: 'Laura — pickleball lesson',     type: 'Lesson',   notes: '' },
];

(async () => {
  try {
    for (const entry of entries) {
      await addScheduleEntry(entry);
    }
    log('All schedule entries added successfully');
  } catch (err) {
    error('Failed to add schedule entries', err);
    process.exit(1);
  }
})();
