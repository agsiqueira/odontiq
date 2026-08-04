import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const [appShell, homePage, casesCarousel, bottomNavigation, onboarding] =
  await Promise.all([
    readSource("src/components/AppShell.tsx"),
    readSource("src/app/home/page.tsx"),
    readSource("src/components/CasesCarousel.tsx"),
    readSource("src/components/BottomNavigation.tsx"),
    readSource("src/components/EncounterOnboarding.tsx"),
  ]);

for (const [name, source] of [
  ["AppShell", appShell],
  ["HomePage", homePage],
] as const) {
  assert.match(source, /max-w-\[30rem\][^"\n]*md:max-w-\[48rem\]/, `${name} must retain the phone width and add the tablet width at md.`);
}

assert.match(casesCarousel, /flex snap-x snap-mandatory/);
assert.match(casesCarousel, /className="w-full shrink-0 snap-center"/);
assert.doesNotMatch(casesCarousel, /(?:md|lg|xl):grid-cols-/);

for (const destination of ["/home", "/cases", "/reports"]) {
  assert.match(bottomNavigation, new RegExp(`href: "${destination}"`));
}
assert.match(bottomNavigation, /max-w-\[27rem\]/);
assert.match(bottomNavigation, /h-14/);

assert.match(onboarding, /max-w-2xl/);
assert.match(onboarding, /sm:grid-cols-2/);
assert.match(onboarding, /size="lg"/);

console.log("Tablet-first shell and case-selection validation passed.");
