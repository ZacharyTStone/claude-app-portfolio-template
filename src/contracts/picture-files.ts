/* What a picture's own file tells the build. The diagram kit (scripts/diagram) writes it, and the build reads
   it (src/components/picture.ts). */

/** On a moving picture's <svg>: for how many seconds a visitor plays it. A picture without it moves all the
    time. */
export const PLAYS_ATTRIBUTE = "data-plays";
