# Brief: Наряд

**This is one of the kit's examples: a concept ad. The service does not exist yet, and the
end card says so.**

A promo for a startup idea of the person's. The product does not exist yet: there is no
app, site, price or customer number. The video shows the concept and makes no figures.
"Наряд" is the agent's name for it (2026-11-04): an ordinary Russian word for an outfit,
and also, in Russian, a work order ("наряд на работу"), which fits an app that dresses you
for work. A web search on 2026-11-04 found wardrobe apps with other names (Fits, Outfitsy,
N2B) and none called "Наряд".

## Product
An app that tells you every morning what to wear to work, and a service that delivers
those outfits: a box of outfits for the week arrives, and the next week it is collected
and swapped for new ones. Base outfits are free.

## Audience and goal
Office workers who see the ad in a social feed (Reels, Shorts, Stories), often without
sound. Afterwards they should want to try it: "I could stop thinking about clothes in the
morning."

## Format
- Length: 48 s (the person asked for 50 s at most)
- Shape: portrait 9:16, 1080×1920, 30 fps
- Language: Russian voice and on-screen text; subtitles of the voice, for feeds on mute
- Voice: the person asked for "normal voiceover" in Russian. The OpenRouter key has a $1
  monthly limit, which was used up on 2026-11-04, so the voice is made locally and for free
  with Qwen3-TTS (Apache-2.0): a female narrator described in words (VoiceDesign) made the
  take of line 05, saved as `assets/voice/ref/narrator.wav`, and every line is cloned from
  it with the Base model so the voice stays the same. The takes were not transcribed back
  (no key); listen before publishing.
- Music: "Werq", Kevin MacLeod (incompetech.com), 125 BPM, CC BY 4.0, credited on the end
  card; scenes are whole bars (1.92 s)
- Footage: Mixkit clips (alarm clock, hangers, courier, a walk to an office) and two clips
  generated with Google Veo 3.1 Fast through OpenRouter (a rail of five outfits, a man
  buttoning his cuff). People are seen from behind or as hands only: the product is not
  real yet, and stock models must not look like they endorse it

## Facts
How it works was left to the agent ("подумай, как это всё должно работать"). Rows marked
*proposed* are the agent's design, written on 2026-11-04 for the person to confirm or change.

| Fact as it will be said | Source |
| ----------------------- | ------ |
| Every morning the app tells you what to wear to work | the person, in this conversation, 2026-11-04 |
| The outfits are delivered for a week, like a clothing delivery | the person, 2026-11-04 |
| Base outfits are free ("бесплатная модель, там есть базовые образы") | the person, 2026-11-04 |
| The outfit of the day takes into account the weather and your calendar | *proposed* |
| Don't like the outfit? Swipe for another | *proposed* |
| The courier brings the week's outfits on Sunday | *proposed* |
| Five outfits, Monday to Friday, in your size | *proposed* |
| A week later they are collected, cleaned and replaced with new ones (so no washing or ironing) | *proposed* |
| Demo morning: Monday, 07:30, +12°, rain after 18:00, 11:00 meeting with a client; user "Тимур" | invented demo data |
| Demo outfits: navy blazer + white shirt (meeting); light blue shirt + knit (calm day); the five outfits on the rail | invented demo data, pictures from the generated rail clip |

## Materials
- No logo existed: a word mark "наряд" in Playfair Display italic with a hanger drawn in SVG
  by the agent.
- Fonts: Playfair Display (OFL) for headlines, Inter (the kit's default) for the app and
  subtitles.
- Colours: cream `#F3EEE6`, ink `#1B1A17`, terracotta `#C8553D`, navy `#1F2A44`.

## Must not
- No prices, customer numbers or partner brands: none exist.
- No real clothing brands or labels on screen; no App Store or Google Play badges.
- No stock faces in focus.
