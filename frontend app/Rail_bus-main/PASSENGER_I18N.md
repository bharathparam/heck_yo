# RailBus Passenger Application: Internationalization (i18n) Architecture

**Document ID:** `PASSENGER_I18N`  
**Version:** 1.0  
**Languages Supported:** English (`en-IN`), Kannada (`kn-IN`)  
**Status:** Under Review (Awaiting User Sign-off)

---

## 1. Overview & Cultural Significance
RailBus operates in Mysuru, Karnataka, serving a balanced demographic of local commuters, rural travelers, daily city workers, and intercity train travelers. 

To provide an equitable, stress-free transit experience, the application offers **first-class bilingual parity** in **English** and **Kannada (ಕನ್ನಡ)**. Internationalization is treated as an architectural foundation rather than a cosmetic translation layer:
- Zero user-facing strings are hardcoded into React JSX/TSX components.
- Language switching is instantaneous with zero screen flashes or full-page reloads.
- Layouts are intentionally engineered to withstand the spatial characteristics of the Kannada script without truncation or visual distortion.

---

## 2. Technical Stack & Architecture

```
+-----------------------------------------------------------------------------------+
|                         i18next Runtime Engine (React)                            |
+-----------------------------------------------------------------------------------+
|  - Provider: I18nextProvider wrapped at root (main.tsx)                           |
|  - Detector: Custom detector reading LocalStorage -> Profile -> Browser default   |
|  - Backend: Bundled JSON translation catalogs (zero asynchronous network delay)   |
+-----------------------------------------------------------------------------------+
                                   |
                   +---------------+---------------+
                   |                               |
                   v                               v
         +-------------------+           +-------------------+
         |  src/locales/en   |           |  src/locales/kn   |
         |  - common.json    |           |  - common.json    |
         |  - booking.json   |           |  - booking.json   |
         |  - ticket.json    |           |  - ticket.json    |
         +-------------------+           +-------------------+
```

### Dependency Configuration:
- `i18next`: Core translation management engine.
- `react-i18next`: High-performance React bindings (`useTranslation` hook).
- `i18next-browser-languagedetector`: Detects user device preferences on initial visit.

---

## 3. Language Selection & Persistence Lifecycle

```
[ First Launch / Splash Screen ]
               |
               v
  (Check localStorage: 'railbus_lang')
         /                   \
(Key Not Present)         (Key Exists: 'en' | 'kn')
       v                             v
[Show Language Screen]       [Load App in Chosen Lang]
       |                             |
(User selects 'kn')                  |
       v                             |
(Save to localStorage)               |
       |                             |
       +--------------+--------------+
                      |
                      v
             [ User Logs In ]
                      |
                      v
      (Sync language to Profile /me)
                      |
        +-------------+-------------+
        |                           |
(Local match profile)    (Profile differs from local)
        |                           |
    (No-op)             (Update local & apply)
```

1. **Pre-Login State:** Language choice is persisted immediately to browser `localStorage.setItem('railbus_lang', langCode)`.
2. **Post-Login Synchronization:** Upon authentication, the client inspects `profile.preferred_language`. If set, it updates the local state; if null, it pushes the current client language choice to the server via profile update.
3. **In-App Quick Toggle:** The segmented pill `[ EN | ಕನ್ನಡ ]` in the persistent TopBar allows a passenger to switch languages at any moment during trip search or ticket inspection with a single tap.

---

## 4. Typography & Kannada Layout Handling Rules

Kannada script characters feature complex conjuncts, ascenders, and descenders that introduce specific typographic challenges:

```
English: "Book Bus"          (8 characters, 1 word, short vertical height)
Kannada: "ಬಸ್ ಕಾಯ್ದಿರಿಸಿ"     (14 characters, 2 words, tall vertical stack)
```

### Layout Adaptation Guidelines:
1. **Vertical Line-Height Headroom:**
   - Standard Latin headlines use `lineHeight: 1.2`. For Kannada, all typography classes enforce a minimum `lineHeight: 1.5` (`leading-relaxed`) to prevent character glyphs from overlapping or clipping against container boundaries.
2. **Horizontal Expansion Budget:**
   - Kannada translations are typically **20% to 40% longer** in text width than English.
   - Fixed-width button containers are strictly prohibited. All buttons use flexible widths (`w-full` on mobile cards, `min-w-[120px]` on action chips) with auto-wrapping text (`whitespace-normal`).
3. **Font Family Pairing:**
   - English & Numerals: `Inter, system-ui, sans-serif` (with `font-feature-settings: 'tnum'` enabled for tabular arrival times, seat counts, and fares).
   - Kannada: `Noto Sans Kannada, Noto Sans, sans-serif`.
   - Fonts are declared with fallback chains in `tailwind.config.ts`:
     ```typescript
     fontFamily: {
       sans: ['Inter', 'Noto Sans Kannada', 'system-ui', 'sans-serif'],
       kannada: ['Noto Sans Kannada', 'sans-serif'],
     }
     ```

---

## 5. Complete Translation Catalog Matrix (Sample)

```json
// src/locales/en.json
{
  "nav": {
    "book": "Book",
    "schedules": "Schedules",
    "tickets": "Tickets",
    "account": "Account"
  },
  "common": {
    "appName": "RailBus",
    "tagline": "Mysuru Feeder Transit",
    "loading": "Loading transit schedules...",
    "offlineNotice": "Offline Mode — Showing cached tickets.",
    "retry": "Try Again",
    "back": "Back",
    "cancel": "Cancel",
    "confirm": "Confirm"
  },
  "registration": {
    "title": "Register Your Trip",
    "subtitle": "Connecting arriving trains with guaranteed KSRTC city feeder buses.",
    "trainNumber": "Train Number / Name",
    "trainPlaceholder": "e.g., 12007 Shatabdi Express",
    "arrivalDate": "Arrival Date",
    "boardingStop": "Boarding Stop",
    "boardingStopDefault": "Mysuru Railway Station (Platform Exit)",
    "destinationStop": "Destination Drop-off Stop",
    "selectDestination": "Select destination locality",
    "findBuses": "Find Matching Buses"
  },
  "buses": {
    "availableTitle": "Available Feeder Buses",
    "subtitle": "Trips depart 20-30 min after your train arrives.",
    "filterBestMatch": "Best Match",
    "filterEarliest": "Earliest",
    "filterLowestFare": "Lowest Fare",
    "bookedProgress": "{{count}} of {{target}} booked",
    "statusOpen": "Collecting Bookings",
    "statusEligible": "Goal Reached - In Review",
    "statusApproved": "Bus Confirmed!",
    "statusAssigned": "Vehicle Assigned",
    "fixedFare": "Fixed Fare",
    "perPassenger": "per seat"
  },
  "seats": {
    "title": "How Many Seats?",
    "subtitle": "KSRTC city buses feature open seating upon boarding.",
    "stepperLabel": "Passengers",
    "totalFare": "Total Fare",
    "seatsSelected": "{{count}} Seat",
    "seatsSelected_plural": "{{count}} Seats",
    "proceedToPayment": "Proceed to Payment"
  },
  "payment": {
    "title": "Confirm & Pay",
    "explanation": "Your payment confirms your booking and counts toward the 20-passenger threshold. If the bus is not approved by the operator, you will receive an automatic full refund.",
    "simSuccess": "Simulate Payment Success",
    "simFailure": "Simulate Payment Failure",
    "payButton": "Pay ₹{{amount}} & Reserve",
    "failureNotice": "Payment simulation failed. Your card was not charged and no demand was counted."
  },
  "ticket": {
    "passTitle": "RailBus Digital Transit Pass",
    "offlineLabel": "Last verified by server at {{time}}",
    "ticketCode": "Ticket Code",
    "seats": "Seats",
    "farePaid": "Fare Paid",
    "busAssigned": "Bus Number",
    "conductor": "Conductor",
    "bay": "Boarding Bay",
    "conductorNotice": "Show this QR code to the KSRTC bus conductor when boarding.",
    "viewAlternatives": "View Alternative City Transit"
  }
}
```

```json
// src/locales/kn.json
{
  "nav": {
    "book": "ಬುಕಿಂಗ್",
    "schedules": "ವೇಳಾಪಟ್ಟಿ",
    "tickets": "ಟಿಕೆಟ್‌ಗಳು",
    "account": "ಖಾತೆ"
  },
  "common": {
    "appName": "ರೈಲ್ ಬಸ್",
    "tagline": "ಮೈಸೂರು ಫೀಡರ್ ಸಾರಿಗೆ",
    "loading": "ವೇಳಾಪಟ್ಟಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    "offlineNotice": "ಆಫ್‌ಲೈನ್ ಮೋಡ್ — ಉಳಿಸಲಾದ ಟಿಕೆಟ್‌ಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ.",
    "retry": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    "back": "ಹಿಂದಕ್ಕೆ",
    "cancel": "ರದ್ದುಮಾಡಿ",
    "confirm": "ದೃಢೀಕರಿಸಿ"
  },
  "registration": {
    "title": "ನಿಮ್ಮ ಪ್ರಯಾಣವನ್ನು ನೋಂದಾಯಿಸಿ",
    "subtitle": "ರೈಲ್ವೆ ನಿಲ್ದಾಣದಿಂದ ನಗರದ ವಿವಿಧ ಭಾಗಗಳಿಗೆ ಖಚಿತ ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ಬಸ್ ಸೇವೆ.",
    "trainNumber": "ರೈಲು ಸಂಖ್ಯೆ / ಹೆಸರು",
    "trainPlaceholder": "ಉದಾ: 12007 ಶತಾಬ್ದಿ ಎಕ್ಸ್‌ಪ್ರೆಸ್",
    "arrivalDate": "ಆಗಮನದ ದಿನಾಂಕ",
    "boardingStop": "ಹತ್ತುವ ನಿಲ್ದಾಣ",
    "boardingStopDefault": "ಮೈಸೂರು ರೈಲ್ವೆ ನಿಲ್ದಾಣ (ಮುಖ್ಯ ದ್ವಾರ)",
    "destinationStop": "ಇಳಿಯುವ ಸ್ಥಳ",
    "selectDestination": "ತಲುಪಬೇಕಾದ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    "findBuses": "ಹೊಂದಾಣಿಕೆಯಾಗುವ ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಿ"
  },
  "buses": {
    "availableTitle": "ಲಭ್ಯವಿರುವ ಫೀಡರ್ ಬಸ್‌ಗಳು",
    "subtitle": "ರೈಲು ಬಂದ 20-30 ನಿಮಿಷಗಳ ನಂತರ ಬಸ್ ಹೊರಡುತ್ತದೆ.",
    "filterBestMatch": "ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ",
    "filterEarliest": "ಮೊದಲು ಹೊರಡುವ",
    "filterLowestFare": "ಕಡಿಮೆ ದರ",
    "bookedProgress": "{{target}} ರಲ್ಲಿ {{count}} ಬುಕಿಂಗ್ ಆಗಿದೆ",
    "statusOpen": "ಮುಂಗಡ ಕಾಯ್ದಿರಿಸಲಾಗುತ್ತಿದೆ",
    "statusEligible": "ಗುರಿ ತಲುಪಿದೆ - ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    "statusApproved": "ಬಸ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ!",
    "statusAssigned": "ವಾಹನ ನಿಯೋಜಿಸಲಾಗಿದೆ",
    "fixedFare": "ನಿಗದಿತ ದರ",
    "perPassenger": "ಪ್ರತಿ ಸೀಟಿಗೆ"
  },
  "seats": {
    "title": "ಎಷ್ಟು ಸೀಟುಗಳು ಬೇಕು?",
    "subtitle": "ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ನಗರ ಬಸ್‌ಗಳಲ್ಲಿ ಹತ್ತಿದ ನಂತರ ಸೀಟುಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಿಕೊಳ್ಳಬಹುದು.",
    "stepperLabel": "ಪ್ರಯಾಣಿಕರು",
    "totalFare": "ಒಟ್ಟು ಮೊತ್ತ",
    "seatsSelected": "{{count}} ಸೀಟು",
    "seatsSelected_plural": "{{count}} ಸೀಟುಗಳು",
    "proceedToPayment": "ಪಾವತಿಗೆ ಮುಂದುವರಿಯಿರಿ"
  },
  "payment": {
    "title": "ದೃಢೀಕರಿಸಿ ಮತ್ತು ಪಾವತಿಸಿ",
    "explanation": "ನಿಮ್ಮ ಪಾವತಿಯು ಬುಕಿಂಗ್ ಅನ್ನು ಖಚಿತಪಡಿಸುತ್ತದೆ ಮತ್ತು 20 ಪ್ರಯಾಣಿಕರ ಗುರಿಗೆ ಲೆಕ್ಕಿಸಲ್ಪಡುತ್ತದೆ. ಒಂದು ವೇಳೆ ಬಸ್ ರದ್ದಾದರೆ, ನಿಮ್ಮ ಪೂರ್ಣ ಹಣವನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮರುಪಾವತಿಸಲಾಗುತ್ತದೆ.",
    "simSuccess": "ಯಶಸ್ವಿ ಪಾವತಿಯನ್ನು ಸಿಮ್ಯುಲೇಟ್ ಮಾಡಿ",
    "simFailure": "ವಿಫಲ ಪಾವತಿಯನ್ನು ಸಿಮ್ಯುಲೇಟ್ ಮಾಡಿ",
    "payButton": "₹{{amount}} ಪಾವತಿಸಿ ಕಾಯ್ದಿರಿಸಿ",
    "failureNotice": "ಪಾವತಿ ಸಿಮ್ಯುಲೇಶನ್ ವಿಫಲವಾಗಿದೆ. ನಿಮ್ಮ ಹಣ ಕಡಿತಗೊಂಡಿಲ್ಲ."
  },
  "ticket": {
    "passTitle": "ರೈಲ್ ಬಸ್ ಡಿಜಿಟಲ್ ಪಾಸ್",
    "offlineLabel": "ಸರ್ವರ್ ಮೂಲಕ ಪರಿಶೀಲಿಸಿದ ಸಮಯ: {{time}}",
    "ticketCode": "ಟಿಕೆಟ್ ಸಂಖ್ಯೆ",
    "seats": "ಸೀಟುಗಳು",
    "farePaid": "ಪಾವತಿಸಿದ ಮೊತ್ತ",
    "busAssigned": "ಬಸ್ ಸಂಖ್ಯೆ",
    "conductor": "ನಿರ್ವಾಹಕ",
    "bay": "ಹತ್ತುವ ಜಾಗ",
    "conductorNotice": "ಬಸ್ ಹತ್ತುವಾಗ ಈ ಕ್ಯೂಆರ್ (QR) ಕೋಡ್ ಅನ್ನು ಕೆ.ಎಸ್.ಆರ್.ಟಿ.ಸಿ ನಿರ್ವಾಹಕರಿಗೆ ತೋರಿಸಿ.",
    "viewAlternatives": "ಇತರ ಸಾರಿಗೆ ಆಯ್ಕೆಗಳನ್ನು ನೋಡಿ"
  }
}
```

---

## 6. String Management Rules for Developers
1. **Linter Rule:** ESLint plugin `react-i18next` enforces that no raw string literals exist inside JSX tags.
2. **Missing Key Handling:** If a key is missing in Kannada, `i18next` automatically falls back to the English dictionary without rendering an empty space or throwing a runtime crash.
3. **Pluralization:** Uses CLDR plural rules supported natively by `i18next` (`_plural` suffix).
