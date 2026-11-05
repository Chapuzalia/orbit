// Web Animations API equivalents of the GSAP eases the dashboard motion is tuned to.
export const EASE = {
  power3: "cubic-bezier(0.215, 0.61, 0.355, 1)",
  power4: "cubic-bezier(0.165, 0.84, 0.44, 1)",
  power2In: "cubic-bezier(0.55, 0.085, 0.68, 0.53)",
  back14: "cubic-bezier(0.34, 1.45, 0.64, 1)",
  back24: "cubic-bezier(0.3, 1.9, 0.5, 1)",
};

export const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// Plays the same keyframes on one element or a list, staggered. `frames` may be a function of the index.
export function play(
  targets,
  frames,
  { stagger = 0, max = 12, delay = 0, ...timing } = {},
) {
  if (reducedMotion() || !targets) return [];
  const list = targets.length === undefined ? [targets] : [...targets];
  return list
    .filter((el) => el?.animate)
    .map((el, i) => {
      const animation = el.animate(
        typeof frames === "function" ? frames(i) : frames,
        {
          fill: "backwards",
          ...timing,
          delay: delay + Math.min(i, max) * stagger,
        },
      );
      animation.id = "dashboard-enter";
      return animation;
    });
}

// Reads the first number in a display string ("1.234,50 €", "45,5 %", "x 12") so it can be counted up.
// Spanish formatting: "," is the decimal mark; "." groups thousands unless it is clearly a decimal ("4.5").
export function parseCount(text) {
  const match = /\d(?:[\d.,\u00a0\u202f ]*\d)?/.exec(text);
  if (!match) return null;
  const raw = match[0].replace(/[\u00a0\u202f ]/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  let decimalMark = "";
  if (comma > -1) decimalMark = ",";
  else if (dot > -1 && raw.length - dot - 1 !== 3) decimalMark = ".";
  const cut = decimalMark ? raw.lastIndexOf(decimalMark) : -1;
  const integer = (cut > -1 ? raw.slice(0, cut) : raw).replace(/[.,]/g, "");
  const fraction = cut > -1 ? raw.slice(cut + 1).replace(/[.,]/g, "") : "";
  return {
    prefix: text.slice(0, match.index),
    suffix: text.slice(match.index + match[0].length),
    value: Number(`${integer}.${fraction || 0}`),
    decimals: fraction.length,
    decimalMark,
    grouped:
      raw.length - fraction.length - (cut > -1 ? 1 : 0) !== integer.length,
  };
}

export function formatCount(parsed, value) {
  const number = value.toLocaleString(
    parsed.decimalMark === "." ? "en-US" : "es-ES",
    {
      minimumFractionDigits: parsed.decimals,
      maximumFractionDigits: parsed.decimals,
      useGrouping: parsed.grouped ? "always" : false,
    },
  );
  return parsed.prefix + number + parsed.suffix;
}
