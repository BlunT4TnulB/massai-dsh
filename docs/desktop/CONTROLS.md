# Desktop controls — what a browser can and cannot see

This file exists because half of a "power-user gesture layer" is **not visible to a web page**. The
rules below are the ones this app can honour, and the ones it deliberately leaves to the operating
system.

## What the mind implements

| input | does |
|---|---|
| drag | turn the sphere |
| two-finger drag | move the centre and the depth |
| wheel | depth (0.11 octave steps) |
| **shift + wheel** | fine depth (0.022 octave steps) |
| **alt + wheel** | breath dial, live, saved |
| **ctrl/cmd + tap** | inspect a star: its name and how many threads it carries |
| 2 taps | stir the simulated activity (rolls over) |
| 3 taps | the whole screen, no chrome |
| 5 taps | the dials |
| **three fingers wide → closing** | the workshop |
| S / Y / L / T / Esc | dials / log / the word / ask box / close whatever is open |
| arrow keys | turn and pitch |

## What a web page cannot receive (and why)

```
trackpad EDGE swipes        the OS delivers these as system gestures, not as page events.
                            No browser sees "two-finger swipe from the left edge of the
                            trackpad"; it sees only a scroll. We do not pretend otherwise.
3/4-finger swipes           owned by Mission Control / Task View / app switching. Capturing
                            them would fight the OS; the app uses explicit keys and taps instead.
modifier + 2-finger drag    arrives as a wheel/scroll with modifier keys, which is exactly what
                            shift+wheel and alt+wheel use above.
palm rejection              the OS does this before the page sees a contact; the page adds its
                            own guard: a tap must move less than 12 px, and a three-pointer
                            gesture must start inside the frame.
```

Where a desktop wants those OS-level gestures, the right tool is **BetterTouchTool / Touchégg / a
native wrapper**, mapping them to:

```
open /assist        the assistant surface
open /mind?panel=1  the dials
open /               the last conversation
```

## Collision rules this app follows

1. **No OS-owned gesture is captured.** Multi-finger trackpad swipes are left to the OS.
2. **Velocity vs distance.** A drag is a drag above 12 px; taps resolve 300 ms after the last contact;
   a three-pointer gesture requires the pointers to arrive together and the spread to shrink by 30 px.
3. **Pointer inside the frame.** Wheel and drag modifiers only act on the canvas; the panel and the
   text box never leak their wheels into the video.
4. **One escape hatch.** `Esc` closes whichever layer is on top, always.
