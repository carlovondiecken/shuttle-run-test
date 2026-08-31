# 20 m Shuttle Test

iPad-friendly app for running a 20 m shuttle/beep test with a full football squad.

## Run

```powershell
cd "C:\Users\CVonDiecken\Documents\Python\adidas FPI\shuttle-run-test"
python -m http.server 8001 --bind 0.0.0.0
```

Open the computer's local network URL on the iPad, then use Safari's Add to Home Screen.

## Features

- Team/session details
- Squad list with player names, bib numbers, bib colors, and optional ages
- Default squad starts with 20 bib slots: five blue, five red, five green, and five yellow
- Start, pause, reset, and test-beep controls
- iPad audio unlock prompt, longer beep, voice cue, and visual beep flash fallback
- English/German announcement language selector with speed announced at the start and when it changes
- Live level, shuttle, elapsed time, distance, MAV estimate, pace, and VO2max estimate
- Tap each player when they stop to record their result
- Results table sorted by distance
- Local storage plus JSON export/import
- Offline app shell after first load

## Protocol

The app uses a common Léger-style 20 m shuttle protocol:

- 20 m shuttle distance
- level 1 starts at 8.5 km/h
- speed increases by 0.5 km/h each level
- shuttle timing is calculated from speed and 20 m distance

VO2max is estimated from final speed using:

`VO2max = 6 * speed(km/h) - 24.4`

This is a field estimate, not a laboratory measurement.

## iPad Audio

Safari requires a user tap before web apps can play sound. Tap `Test beep` once before starting, make sure the iPad volume is up, and check silent/focus modes if the beep is not audible. Voice cues can be set to English or German and use the best available system voice with a lower pitch setting, but the exact voice depends on the voices installed on the iPad. The cue announces speed at the start and on step 1 of each new level; otherwise it only announces the current level and step.
