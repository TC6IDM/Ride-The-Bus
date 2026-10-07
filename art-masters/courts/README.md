# Court card masters

The twelve English-pattern court cards the game's J, Q and K faces are made
from. **Never served**: this directory is outside the app, like
`audio-masters/`. The file the game loads is
`web-sdk/apps/Ride-The-Bus/static/cards/courts.svg`, and
`scripts/court-art.mjs` rebuilds it from these.

## Provenance

| | |
|---|---|
| Author | Дмитрий Фомин (Dmitry Fomin) |
| Licence | **Creative Commons CC0 1.0 Universal Public Domain Dedication** on every file, and on the deck they were extracted from |
| Parent work | [English pattern playing cards deck.svg](https://commons.wikimedia.org/wiki/File:English_pattern_playing_cards_deck.svg), "own work", 2017, CC0 1.0 |
| Pattern | The English pattern, the standard Anglo-American court design, which is centuries old and in the public domain as a design |
| Retrieved | 2026-09-25 from Wikimedia Commons, each file checked against the SHA-1 the Commons API reports for it |

CC0 needs no attribution. It is recorded anyway, because a reviewer asking
where the courts came from should get an answer in one click.

**Sources considered and rejected, so nobody re-opens them:**

- **RevK / me.uk SVG playing cards.** The website says CC0, but the source
  repository (codeberg.org/RevK/SVG-playing-cards) is GPL-3.0, and its court
  data lives in that repository.
- **Chris Aguilar's Vector Playing Cards and David Bellot's SVG-cards.** Both
  are LGPL, which does not suit a closed, inlined bundle.
- **AI-generated courts.** Stake names "generic AI-generated assets" as a cause
  of a low rating, and the tile foreground's mangled Jack shows why.

## Files

| File | SHA-1 (as served by Commons) | Commons page |
|---|---|---|
| English_pattern_king_of_spades.svg | a3ac0a3635c88f8d9c5b3a62116164a479599fdd | https://commons.wikimedia.org/wiki/File:English_pattern_king_of_spades.svg |
| English_pattern_king_of_hearts.svg | 7d0ff92fc97dd050952a084772d6a3e29b9fb667 | https://commons.wikimedia.org/wiki/File:English_pattern_king_of_hearts.svg |
| English_pattern_king_of_diamonds.svg | 742ec97e535381a34710865eb19bcd84732cb9b2 | https://commons.wikimedia.org/wiki/File:English_pattern_king_of_diamonds.svg |
| English_pattern_king_of_clubs.svg | c31c3bcbb46382c80754201bc75029f3397d10f5 | https://commons.wikimedia.org/wiki/File:English_pattern_king_of_clubs.svg |
| English_pattern_queen_of_spades.svg | 43c2f5a8c2a99e4badd65e0b3680a3662d568bd1 | https://commons.wikimedia.org/wiki/File:English_pattern_queen_of_spades.svg |
| English_pattern_queen_of_hearts.svg | 14a295b2888296db7066c85e06304f05e156ed5c | https://commons.wikimedia.org/wiki/File:English_pattern_queen_of_hearts.svg |
| English_pattern_queen_of_diamonds.svg | 837c80a400421add43ed7152235be65224b3a49d | https://commons.wikimedia.org/wiki/File:English_pattern_queen_of_diamonds.svg |
| English_pattern_queen_of_clubs.svg | 1557f58ced0d1276aa3527913bce1e41e7d3b377 | https://commons.wikimedia.org/wiki/File:English_pattern_queen_of_clubs.svg |
| English_pattern_jack_of_spades.svg | 38650cf0b1b814ef57f64c90de64b78375c77490 | https://commons.wikimedia.org/wiki/File:English_pattern_jack_of_spades.svg |
| English_pattern_jack_of_hearts.svg | 922d2a9e56aea084c72d0009b48839533c129d37 | https://commons.wikimedia.org/wiki/File:English_pattern_jack_of_hearts.svg |
| English_pattern_jack_of_diamonds.svg | 3c3863caf9740be3b3e922dffd9cdf1ae2fde0b3 | https://commons.wikimedia.org/wiki/File:English_pattern_jack_of_diamonds.svg |
| English_pattern_jack_of_clubs.svg | 128300e71730a491215145c9ebc0b0493e775a42 | https://commons.wikimedia.org/wiki/File:English_pattern_jack_of_clubs.svg |

`sha1sum art-masters/courts/*.svg` re-checks them.

## What the game does with them (the restyle)

`scripts/court-art.mjs` does all of this. Run it from the repo root with
`node scripts/court-art.mjs`.

1. **Keeps the figure only.** It drops the card, the frame, both corner indices
   and the big pip beside each head. The game's `CardFace` draws all four
   itself, so every suit mark in the game is the same drawing.
2. **Stores half.** Each court is point-symmetric, so only the half that touches
   the top of the panel is kept, and the bottom is the same art turned 180°.
   - Three are turned about a centre a fraction of a unit off true: Q♥, Q♠ and
     K♣. Fomin placed their lower halves that way.
   - The script re-renders every court against its master and fails if more
     than 1% of pixels differ.
3. **Maps five historical inks to six roles.** Paper, gold, tone, deep, line and
   tint.
   - Each role is a CSS custom property, so `tokens.css` owns the colours.
   - Each suit colour draws in only its own family: red, maroon and gold for
     hearts and diamonds; ink, slate and gold for spades and clubs.
   - Card 1's guess is Red or Black, and a court mixing both would blur that
     read.
4. **Rounds to whole units** with svgo, pinned to 3.3.2 and fetched through npx
   rather than added to the project. At the largest a card is drawn (about 300
   physical pixels), rounding moves nothing a player can see.
