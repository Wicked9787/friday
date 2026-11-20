# Friday Shortcut: Master Document

Version 2, chunked. Built for the Apple Shortcuts describe box (iOS 27). This file is the single source of truth. Each chunk below is also saved as its own file in `chunks/`.

## How to use

1. **Build 00 CORE first.** Paste it into the describe box. It creates the shortcut named **Friday** with the greeting, listening, and the Groq answer at the bottom. After it builds, open the Get Contents of URL step, find the Authorization header, and replace `PASTE_API_KEY_HERE` with your Groq key by hand (keep the word Bearer and the space).
2. **Paste the other chunks one at a time, in the order listed.** Each one adds a single command just above the comment **COMMANDS GO ABOVE THIS LINE**. Wait for each to finish before pasting the next.
3. **Order matters only where noted** (see "Order rules"). Each new chunk lands just above the comment, so the order you paste is the order Friday checks commands.
4. **To change a feature:** edit that chunk here in the master, then in Shortcuts delete the old If block for that command (from its If down to its End If), and paste only the updated chunk. Nothing else needs to change. If the chunk has an order rule, drag the new block to the right spot after it builds.
5. **To add a feature:** write a new chunk using the same pattern, add it to the index, and paste just that one.
6. **Placeholders to swap:** `MY_LIGHTS` and `MY_TV` are your Home accessory names in "My Home, My love, My World". `PASTE_API_KEY_HERE` is your Groq key. Never share the key.
7. **Phrases to say:** say the exact words shown in the "Say" column, for example "lights on", not "turn on the lights".


## Index

| # | Chunk | Say | File | Order note |
|---|---|---|---|---|
| 00 | CORE (build first) | - | chunks/00-core.txt | - |
| 01 | Text Batsie | text batsie | chunks/01-text-batsie.txt | Must be first of all command chunks, so the words inside your message never trigger another command. |
| 02 | Reminder | remind me to | chunks/02-remind-me.txt | Keep before 03-05 so reminder text does not trigger other commands. |
| 03 | What do you remember | what do you remember | chunks/03-what-do-you-remember.txt | Must be before 04-remember, because this phrase contains the word remember. |
| 04 | Remember | remember | chunks/04-remember.txt | After 03. |
| 05 | Quick note | begins with note | chunks/05-note.txt | Uses begins with (not contains) so words like notification do not trigger it. |
| 06 | Lights brightness | percent / % | chunks/06-lights-percent.txt | Must be before 07 and 08, because "lights on to 50 percent" also contains "lights on". |
| 07 | Lights on | lights on | chunks/07-lights-on.txt | - |
| 08 | Lights off | lights off | chunks/08-lights-off.txt | - |
| 09 | TV on | tv on | chunks/09-tv-on.txt | - |
| 10 | TV off | tv off | chunks/10-tv-off.txt | - |
| 11 | Good night | good night | chunks/11-good-night.txt | - |
| 12 | Cameras | camera | chunks/12-cameras.txt | - |
| 13 | Music | music | chunks/13-music.txt | - |
| 14 | Open Cash App | cash app | chunks/14-open-cash-app.txt | Specific app chunks go before 16 open-app. |
| 15 | APP TEMPLATE (do not paste as-is) | open APPNAME | chunks/15-app-template.txt | Copy, replace every APPNAME with the app name in lowercase for the phrase (for example open tiktok) and the real app name for Open App (TikTok). Paste before 16. Add one per app: Facebook, TikTok, Messenger, Scoopz, Gmail, Wallet, Experian, Smart Home, Home, Maps, Photos, Notes, Files, Contacts, Temu, App Store, Settings, Playground, Paint Love, Muse, Widgetsmith, Grok, Grok Bot. Note: the phrase "open home" also matches "open smart home", so paste Smart Home before Home, and "open grok bot" before "open grok". |
| 16 | Open any app | open app | chunks/16-open-app.txt | After all specific app chunks. |
| 17 | Timer | timer | chunks/17-timer.txt | - |
| 18 | Alarm | alarm | chunks/18-alarm.txt | - |
| 19 | Read my texts (honest version) | read my texts | chunks/19-read-my-texts.txt | Shortcuts cannot read message content. This chunk opens Messages and says so. |
| 20 | Find my phone | find my phone | chunks/20-find-my-phone.txt | Shortcuts has no siren sound, so she speaks loudly at full volume. |
| 21 | Battery | battery | chunks/21-battery.txt | - |
| 22 | Morning briefing | good morning | chunks/22-morning-briefing.txt | Before 23 weather. |
| 23 | Weather | weather | chunks/23-weather.txt | - |
| 24 | Do Not Disturb on | do not disturb on | chunks/24-dnd-on.txt | - |
| 25 | Do Not Disturb off | do not disturb off | chunks/25-dnd-off.txt | - |
| 26 | Goodbye | goodbye | chunks/26-goodbye.txt | - |
| 27 | Run diagnostics | run diagnostics | chunks/27-diagnostics.txt | - |
| 28 | BATSIE MODE (Batsie's phone only) | - | chunks/28-batsie-mode.txt | - |
| 29 | Calendar today (new in v2) | what's on my calendar / my schedule | chunks/29-calendar-today.txt | Paste right after 02 remind-me, so words in an event never trigger another command. |
| 30 | Add a calendar event (new in v2) | add an event … / schedule a … | chunks/30-add-event.txt | Paste right after 29. |

## Order rules

- **01 text-batsie** goes first of the commands, so words inside your message (like "lights on") never trigger another command.
- **02 remind-me** before 03-05, so reminder text is not taken as a note or memory.
- **03 what-do-you-remember** before **04 remember** (the phrase contains "remember").
- **06 lights-percent** before **07 lights-on** and **08 lights-off** ("lights on to 50 percent" contains "lights on").
- **14 open-cash-app** and every app made from **15 template** go before **16 open-app**. "open smart home" goes before "open home", and "open grok bot" before "open grok".
- **22 morning-briefing** before **23 weather**.
- **29 calendar-today** and **30 add-event** go right after **02 remind-me** (drag them up after they build).
- **24 / 25 do not disturb on / off** do not overlap, so either order works.
- Everything else can go in any order.

## Chunks

### 00 · CORE (build first)

```
Create a new shortcut named Friday. Steps in this exact order:
1. Make a List of these phrases ["At your service, sir.", "Good to see you, sir.", "Friday online. What do you need, sir?", "Ready when you are, sir.", "How can I help, sir?", "Listening, sir."], Get Random Item from that list, and Speak it with a UK English male voice.
2. Dictate Text.
3. Change Case of the Dictated Text to lowercase.
4. Set Variable cmd to the lowercase text.
5. Add a Comment step that says: COMMANDS GO ABOVE THIS LINE
6. Get Contents of URL https://api.groq.com/openai/v1/chat/completions with Method POST. Headers: Authorization = Bearer PASTE_API_KEY_HERE, Content-Type = application/json. Request Body JSON with: model (Text) = openai/gpt-oss-20b, reasoning_effort (Text) = low, include_reasoning (Boolean) = false, messages (Array) = a list of 2 dictionaries: first dictionary role = system, content = You are Friday, a warm, witty, concise personal assistant for Sky. Address the user as sir. Keep replies to 1-3 short spoken sentences. Second dictionary role = user, content = the cmd variable.
7. Get Dictionary Value for key choices.1.message.content from the Contents of URL.
8. Speak that value with a UK English male voice.
9. Wait 3 seconds.
```

### 01 · Text Batsie

_Note: Must be first of all command chunks, so the words inside your message never trigger another command._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "text batsie": Replace "text batsie" with nothing in cmd, Send Message with the replaced text to the contact Batsie, then make a List of these phrases ["Message sent to Batsie, sir.", "Done, sir. Batsie has it.", "Your text is on its way, sir.", "Sent. Batsie should see it shortly, sir.", "Message delivered to Batsie, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 02 · Reminder

_Note: Keep before 03-05 so reminder text does not trigger other commands._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "remind me to": Replace "remind me to" with nothing in cmd, Get Dates from the replaced text, Add New Reminder with the replaced text as the title and an alert at the found date (if a date was found), then make a List of these phrases ["Reminder set, sir.", "I will remind you, sir.", "Consider it noted, sir.", "Got it. I will nudge you, sir.", "Reminder saved, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 03 · What do you remember

_Note: Must be before 04-remember, because this phrase contains the word remember._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "what do you remember": Find Notes where Name is "Friday Memory", Get the body of that note, make a List of these phrases ["Here is what I remember, sir.", "From my memory, sir.", "This is what you told me, sir.", "Pulling up my notes, sir."], Get Random Item from that list, and Speak it with the UK English male voice, then Speak the note body with the UK English male voice. Stop this shortcut. End If.
```

### 04 · Remember

_Note: After 03._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "remember": Replace "remember" with nothing in cmd, Append the replaced text to the note named "Friday Memory" (create the note if it does not exist), then make a List of these phrases ["I will remember that, sir.", "Saved to memory, sir.", "Locked in, sir.", "Noted for later, sir.", "Got it, sir. I will not forget."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 05 · Quick note

_Note: Uses begins with (not contains) so words like notification do not trigger it._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd begins with "note": Replace "note" with nothing in cmd, Append the replaced text to the note named "Friday Notes" (create the note if it does not exist), then make a List of these phrases ["Note saved, sir.", "Added to your notes, sir.", "Written down, sir.", "Done, sir. It is in Friday Notes."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 06 · Lights brightness

_Note: Must be before 07 and 08, because "lights on to 50 percent" also contains "lights on"._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "percent" or cmd contains "%": Match Text \d+ in cmd, Get the first match, Control My Home in the home "My Home, My love, My World": set MY_LIGHTS brightness to that number percent, then make a List of these phrases ["Lights adjusted, sir.", "Brightness set, sir.", "There you go, sir.", "Lights dialed in, sir.", "Done, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 07 · Lights on

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "lights on": Control My Home in the home "My Home, My love, My World": turn MY_LIGHTS on, then make a List of these phrases ["Lights on, sir.", "Let there be light, sir.", "Brightening things up, sir.", "Lights are on, sir.", "Done, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 08 · Lights off

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "lights off": Control My Home in the home "My Home, My love, My World": turn MY_LIGHTS off, then make a List of these phrases ["Lights off, sir.", "Going dark, sir.", "Lights are out, sir.", "Done, sir.", "Shutting the lights, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 09 · TV on

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "tv on": Control My Home in the home "My Home, My love, My World": turn MY_TV on, then make a List of these phrases ["TV on, sir.", "Showtime, sir.", "Turning on the TV, sir.", "The TV is on, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 10 · TV off

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "tv off": Control My Home in the home "My Home, My love, My World": turn MY_TV off, then make a List of these phrases ["TV off, sir.", "Screen is off, sir.", "Turning off the TV, sir.", "Done, sir. TV is off."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 11 · Good night

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "good night": Control My Home in the home "My Home, My love, My World": turn MY_LIGHTS off and turn MY_TV off, then make a List of these phrases ["Good night, sir. Sleep well.", "Rest up, sir. I have got the house.", "Sweet dreams, sir.", "Everything is off. Good night, sir.", "Lights out. Good night, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 12 · Cameras

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "camera": make a List of these phrases ["Opening your cameras, sir.", "Pulling up the cameras, sir.", "Here are your cameras, sir.", "Let us take a look, sir."], Get Random Item from that list, and Speak it with the UK English male voice, then Open App Smart Home. Stop this shortcut. End If.
```

### 13 · Music

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "music": make a List of these phrases ["Playing your music, sir.", "Music coming up, sir.", "Let us set the mood, sir.", "Here is some music, sir."], Get Random Item from that list, and Speak it with the UK English male voice, then Play Music from Apple Music (shuffle my library). Stop this shortcut. End If.
```

### 14 · Open Cash App

_Note: Specific app chunks go before 16 open-app._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "cash app": make a List of these phrases ["Opening Cash App, sir.", "Here is Cash App, sir.", "Cash App, coming up, sir.", "Pulling up Cash App, sir."], Get Random Item from that list, and Speak it with the UK English male voice, then Open App Cash App. Stop this shortcut. End If.
```

### 15 · APP TEMPLATE (do not paste as-is)

_Note: Copy, replace every APPNAME with the app name in lowercase for the phrase (for example open tiktok) and the real app name for Open App (TikTok). Paste before 16. Add one per app: Facebook, TikTok, Messenger, Scoopz, Gmail, Wallet, Experian, Smart Home, Home, Maps, Photos, Notes, Files, Contacts, Temu, App Store, Settings, Playground, Paint Love, Muse, Widgetsmith, Grok, Grok Bot. Note: the phrase "open home" also matches "open smart home", so paste Smart Home before Home, and "open grok bot" before "open grok"._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "open APPNAME": make a List of these phrases ["Opening APPNAME, sir.", "Here is APPNAME, sir.", "APPNAME, coming up, sir.", "Pulling up APPNAME, sir."], Get Random Item from that list, and Speak it with the UK English male voice, then Open App APPNAME. Stop this shortcut. End If.
```

### 16 · Open any app

_Note: After all specific app chunks._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "open app": make a List of these phrases ["Which app, sir?", "Pick an app, sir.", "Your apps, sir.", "Choose one, sir."], Get Random Item from that list, and Speak it with the UK English male voice, then Open App with the app set to Ask Each Time. Stop this shortcut. End If.
```

### 17 · Timer

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "timer": Match Text \d+ in cmd, Get the first match, Start Timer for that number of minutes, then make a List of these phrases ["Timer started, sir.", "Clock is running, sir.", "I will let you know when time is up, sir.", "Timer set, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 18 · Alarm

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "alarm": Get Dates from cmd, Create Alarm at that time, then make a List of these phrases ["Alarm set, sir.", "I will wake you, sir.", "Alarm is on, sir.", "Done, sir. Alarm saved."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 19 · Read my texts (honest version)

_Note: Shortcuts cannot read message content. This chunk opens Messages and says so._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "read my texts": make a List of these phrases ["I cannot read messages myself, sir, so I am opening Messages for you.", "Apple keeps your texts private from me, sir. Opening Messages.", "I am not allowed to read texts, sir. Here is Messages.", "Opening Messages for you, sir. I cannot read them aloud."], Get Random Item from that list, and Speak it with the UK English male voice, then Open App Messages. Stop this shortcut. End If.
```

### 20 · Find my phone

_Note: Shortcuts has no siren sound, so she speaks loudly at full volume._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "find my phone": Set Volume to 100%, then Repeat 3 times: make a List of these phrases ["Over here, sir!", "I am right here, sir!", "This way, sir!", "Here I am, sir!", "Follow my voice, sir!"], Get Random Item from that list, and Speak it with the UK English male voice. End Repeat. Stop this shortcut. End If.
```

### 21 · Battery

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "battery": Get Battery Level, then make a List of these phrases ["Battery is at [Battery Level] percent, sir.", "You have [Battery Level] percent left, sir.", "Power is at [Battery Level] percent, sir.", "We are at [Battery Level] percent, sir."] using the Battery Level variable, Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 22 · Morning briefing

_Note: Before 23 weather._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "good morning": make a List of these phrases ["Good morning, sir. Here is your day.", "Morning, sir. Let us get you up to speed.", "Rise and shine, sir. Your briefing.", "Good morning, sir. Here is what is ahead."], Get Random Item from that list, and Speak it with the UK English male voice. Get Current Weather, Get Details of Weather: Condition and Temperature, Speak "Right now it is [Condition] and [Temperature]." Find Calendar Events where Start Date is today, Count them, Speak "You have [Count] events today." then Speak the titles of the events. Find Reminders where Due Date is today and Is Not Completed, Count them, Speak "And [Count] reminders due today." then Speak their titles. Stop this shortcut. End If.
```

### 23 · Weather

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "weather": Get Current Weather, Get Details of Weather: Condition and Temperature, then make a List of these phrases ["It is [Condition] and [Temperature] right now, sir.", "Currently [Condition], [Temperature], sir.", "Outside it is [Condition] at [Temperature], sir.", "Looks [Condition] out there, [Temperature], sir."] using those variables, Get Random Item, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 24 · Do Not Disturb on

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "do not disturb on": Set Focus Do Not Disturb to On until turned off, then make a List of these phrases ["Do Not Disturb is on, sir.", "Silencing the world, sir.", "No interruptions, sir.", "Quiet mode on, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 25 · Do Not Disturb off

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "do not disturb off": Set Focus Do Not Disturb to Off, then make a List of these phrases ["Do Not Disturb is off, sir.", "You are reachable again, sir.", "Notifications are back, sir.", "Quiet mode off, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 26 · Goodbye

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "goodbye": make a List of these phrases ["Goodbye, sir.", "Until next time, sir.", "Signing off, sir.", "Take care, sir.", "Friday out, sir."], Get Random Item from that list, and Speak it with the UK English male voice. Stop this shortcut. End If.
```

### 27 · Run diagnostics

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "run diagnostics": Choose from Menu with options "Test responses" and "System checklist".
Under "Test responses": Speak "Greeting test. At your service, sir." then Speak "Lights test. Lights on, sir." then Speak "Goodbye test. Until next time, sir." with the UK English male voice.
Under "System checklist": Set Variable failed to Number 0. Set Variable report_lines to an empty List. Get Battery Level; If it has any value, Add "Battery: OK" to report_lines, Otherwise Add "Battery: FAILED" to report_lines and Calculate failed + 1 and Set Variable failed to the result, End If. Get Current Weather; same check with "Weather: OK" / "Weather: FAILED". Get Network Details (Wi-Fi network name); same check with "Wi-Fi: OK" / "Wi-Fi: FAILED". Get Current Location; same check with "Location: OK" / "Location: FAILED". Combine report_lines with New Lines and Show Result. If failed is 0, make a List of these phrases ["All systems normal, sir.", "Everything checks out, sir.", "Fully operational, sir.", "All green, sir."], Get Random Item from that list, and Speak it with the UK English male voice; Otherwise Speak "[failed] checks failed, sir. See the report." End If. End Menu. Stop this shortcut. End If.
```

### 28 · BATSIE MODE (Batsie's phone only)

```
Do this on Batsie's phone, not Sky's. Build 00 CORE there, but in the describe text change every "sir" to "ma'am", change "for Sky" to "for Batsie", and change "UK English male voice" to "UK English female voice". Then paste the same chunks in the same order, with the same three changes made in each chunk before pasting. Skip 01 text-batsie on her phone (or make a copy that says "text sky" and sends to the contact Sky).
```

### 29 · Calendar today (new in v2)

_Note: Paste right after 02 remind-me. The Friday and Jarvis apps send "what's on my calendar today" here. Silent: it shows a notification, and the app does the talking._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "calendar" or cmd contains "schedule" or cmd contains "appointment" or cmd contains "what's on", and cmd does not contain "add": If cmd contains "tomorrow", Adjust Date Current Date by adding 1 day and Set Variable day to it, Otherwise Set Variable day to Current Date, End If. Find Calendar Events where Start Date is in day (the whole day), sorted by Start Date, oldest first. If Calendar Events has any value: Repeat with Each Calendar Event: Format the Start Date of the Repeat Item as a short time (no date), and Add "[Title of Repeat Item] at [Formatted Date]" to the variable agenda; End Repeat. Combine agenda with New Lines and Show Notification with the title "Today" (or "Tomorrow") and the combined text as the body, with Play Sound turned off. Otherwise Show Notification "Nothing on the calendar." with Play Sound turned off. End If. Do not add any Speak Text step; the app does the talking. Stop this shortcut. End If.
```

### 30 · Add a calendar event (new in v2)

_Note: Paste right after 29. The apps send things like "add an event dentist on Friday at 3pm" here. Silent: it shows a quiet notification._

```
In my Friday shortcut, add above the comment COMMANDS GO ABOVE THIS LINE, without changing any other steps: If cmd contains "add" and (cmd contains "event" or cmd contains "appointment" or cmd contains "calendar"), or cmd begins with "schedule a" or cmd begins with "schedule an": Get Dates from cmd and Set Variable when to the first date. Replace in cmd the words "add an event", "add a event", "add an appointment", "add to my calendar", "add to calendar", "schedule an", "schedule a", "for", "on my calendar" with nothing, and remove the date and time words, then Set Variable title to the trimmed result. If when has no value, Set Variable when to tomorrow at 9:00 AM. Add New Event to the default calendar with Title title, Start Date when, End Date when plus 1 hour. Show Notification "Added [title] for [when formatted as a medium date and short time]" with Play Sound turned off. Do not add any Speak Text step; the app does the talking. Stop this shortcut. End If.
```

## AUTOMATIONS (set up in Shortcuts > Automation, not the describe box)

For each: open Shortcuts, tap **Automation**, tap **+**, pick the trigger, choose **Run Immediately**, then add **Run Shortcut** (pick Friday) or the actions listed.

- **Arrive home:** Trigger Arrive, location = home. Actions: Control My Home turn MY_LIGHTS on, Speak "Welcome home, sir."
- **Leave home:** Trigger Leave, location = home. Actions: turn MY_LIGHTS and MY_TV off, Speak "Goodbye, sir. Everything is off."
- **Wake time:** Trigger Alarm "Is Stopped" (or Time of Day at your wake-up time). Action: Run Shortcut Friday with the text "good morning" as input. (Tip: add to 00 CORE an If that uses the Shortcut Input as cmd when there is input, otherwise Dictate.)
- **Bedtime:** Trigger Time of Day (your bedtime) or Sleep "Bedtime begins". Actions: turn MY_LIGHTS and MY_TV off, Set Focus Sleep on, Speak "Good night, sir."
- **Charger connected:** Trigger Charger "Is Connected", and Time Range night only if you like. Actions: same as Bedtime.
- **Home Wi-Fi:** Trigger Wi-Fi, choose your home network. Actions: same as Arrive home.
- **Focus:** Trigger Focus (for example Work or Sleep) "When turning on". Action: Speak a line like "Work mode on, sir." or turn lights down.
- **CarPlay:** Trigger CarPlay "Connects". Action: Speak "Ready to drive, sir." and Play Music. Say "Hey Siri, Friday" while driving to run her hands-free.
- **Low battery:** Trigger Battery Level "Falls Below 20%". Action: Speak "Battery is low, sir. Please charge me." (and optionally turn on Low Power Mode).

## LAUNCH OPTIONS

- **Vocal Shortcut "Friday":** Settings > Accessibility > Vocal Shortcuts > Set Up > Shortcut > Friday. Record the word "Friday" three times.
- **Back Tap:** Settings > Accessibility > Touch > Back Tap > Double Tap > Friday.
- **Action Button** (iPhone 15 Pro and newer): Settings > Action Button > swipe to Shortcut > choose Friday.
- **Widget:** long-press the home screen > Edit > Add Widget > Shortcuts > pick the single-shortcut size > tap it and choose Friday. Lock screen: long-press lock screen > Customize > Add Widgets > Shortcuts > Friday.
- **Control Center:** open Control Center > tap + > Add a Control > Shortcuts > Shortcut > choose Friday. Add a second control: search **Open App** and choose the Friday app, so one tap opens her listening.
