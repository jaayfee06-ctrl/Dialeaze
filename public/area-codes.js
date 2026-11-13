/* =========================================================
   NORTH AMERICAN AREA CODES
   Every US state, DC, US territories and Canada.

   Line format:   CODE STATE ZONE Main city
   ZONE keys are listed in AREA_CODE_ZONES below.
   A "*" after the zone means the area code crosses a
   time-zone line; the zone shown is the one used by the
   main city, so the time may differ in part of that area.
========================================================= */

export const AREA_CODE_ZONES = {
    E: "America/New_York",
    C: "America/Chicago",
    M: "America/Denver",
    AZ: "America/Phoenix",          // Arizona: no daylight saving
    P: "America/Los_Angeles",
    AK: "America/Anchorage",
    HI: "Pacific/Honolulu",
    IN: "America/Indiana/Indianapolis",
    DET: "America/Detroit",
    PR: "America/Puerto_Rico",      // Puerto Rico + US Virgin Islands
    GU: "Pacific/Guam",
    MP: "Pacific/Saipan",
    AS: "Pacific/Pago_Pago",
    TOR: "America/Toronto",
    WIN: "America/Winnipeg",
    REG: "America/Regina",          // Saskatchewan: no daylight saving
    EDM: "America/Edmonton",
    VAN: "America/Vancouver",
    HAL: "America/Halifax",
    MON: "America/Moncton",
    NL: "America/St_Johns",
    WH: "America/Whitehorse"
};

export const STATE_NAMES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
    CA: "California", CO: "Colorado", CT: "Connecticut",
    DE: "Delaware", DC: "Washington DC", FL: "Florida",
    GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
    LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana",
    NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York",
    NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
    OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
    TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
    VA: "Virginia", WA: "Washington", WV: "West Virginia",
    WI: "Wisconsin", WY: "Wyoming",
    PR: "Puerto Rico", VI: "US Virgin Islands", GU: "Guam",
    MP: "Northern Mariana Islands", AS: "American Samoa",
    AB: "Alberta", BC: "British Columbia", MB: "Manitoba",
    NB: "New Brunswick", NL: "Newfoundland", NS: "Nova Scotia",
    ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
    SK: "Saskatchewan", YT: "Yukon / NWT / Nunavut"
};

const RAW_AREA_CODES = `
205 AL C Birmingham
251 AL C Mobile
256 AL C Huntsville
334 AL C Montgomery
483 AL C Montgomery
659 AL C Birmingham
938 AL C Huntsville
907 AK AK Anchorage
480 AZ AZ Mesa
520 AZ AZ Tucson
602 AZ AZ Phoenix
623 AZ AZ Glendale
928 AZ AZ Flagstaff
327 AR C Jonesboro
479 AR C Fort Smith
501 AR C Little Rock
870 AR C Jonesboro
209 CA P Stockton
213 CA P Los Angeles
279 CA P Sacramento
310 CA P Los Angeles (West)
323 CA P Los Angeles
341 CA P Oakland
350 CA P Stockton
357 CA P Fresno
369 CA P Santa Rosa
408 CA P San Jose
415 CA P San Francisco
424 CA P Los Angeles (West)
442 CA P Palm Springs
510 CA P Oakland
530 CA P Redding
559 CA P Fresno
562 CA P Long Beach
619 CA P San Diego
626 CA P Pasadena
628 CA P San Francisco
650 CA P San Mateo
657 CA P Anaheim
661 CA P Bakersfield
669 CA P San Jose
707 CA P Santa Rosa
714 CA P Anaheim
738 CA P Los Angeles
747 CA P Los Angeles (San Fernando Valley)
760 CA P Palm Springs
805 CA P Santa Barbara
818 CA P Los Angeles (San Fernando Valley)
820 CA P Santa Barbara
831 CA P Salinas
840 CA P San Bernardino
858 CA P San Diego
909 CA P San Bernardino
916 CA P Sacramento
925 CA P Concord
949 CA P Irvine
951 CA P Riverside
303 CO M Denver
719 CO M Colorado Springs
720 CO M Denver
748 CO M Colorado Springs
970 CO M Fort Collins
983 CO M Denver
203 CT E New Haven
475 CT E New Haven
860 CT E Hartford
959 CT E Hartford
302 DE E Wilmington
202 DC E Washington
771 DC E Washington
239 FL E Fort Myers
305 FL E Miami
321 FL E Orlando
324 FL E Jacksonville
352 FL E Gainesville
386 FL E Daytona Beach
407 FL E Orlando
448 FL C* Pensacola
561 FL E West Palm Beach
645 FL E Miami
656 FL E Tampa
689 FL E Orlando
727 FL E St. Petersburg
728 FL E West Palm Beach
754 FL E Fort Lauderdale
772 FL E Port St. Lucie
786 FL E Miami
813 FL E Tampa
850 FL E* Tallahassee
863 FL E Lakeland
904 FL E Jacksonville
941 FL E Sarasota
954 FL E Fort Lauderdale
229 GA E Albany
404 GA E Atlanta
470 GA E Atlanta
478 GA E Macon
678 GA E Atlanta
706 GA E Augusta
762 GA E Augusta
770 GA E Atlanta
912 GA E Savannah
943 GA E Atlanta
808 HI HI Honolulu
208 ID M* Boise
986 ID M* Boise
217 IL C Springfield
224 IL C Northbrook
309 IL C Peoria
312 IL C Chicago
331 IL C Aurora
447 IL C Champaign
464 IL C Cicero
618 IL C Belleville
630 IL C Aurora
708 IL C Cicero
730 IL C Belleville
773 IL C Chicago
779 IL C Rockford
815 IL C Rockford
847 IL C Evanston
861 IL C Peoria
872 IL C Chicago
219 IN C* Gary
260 IN IN Fort Wayne
317 IN IN Indianapolis
463 IN IN Indianapolis
574 IN IN* South Bend
765 IN IN Lafayette
812 IN C* Evansville
930 IN C* Evansville
319 IA C Cedar Rapids
515 IA C Des Moines
563 IA C Davenport
641 IA C Mason City
712 IA C Sioux City
316 KS C Wichita
620 KS C* Hutchinson
785 KS C* Topeka
913 KS C Kansas City
270 KY C* Bowling Green
364 KY C* Bowling Green
502 KY E Louisville
606 KY E* Ashland
859 KY E Lexington
225 LA C Baton Rouge
318 LA C Shreveport
337 LA C Lafayette
457 LA C Shreveport
504 LA C New Orleans
985 LA C Houma
207 ME E Portland
227 MD E Rockville
240 MD E Rockville
301 MD E Rockville
410 MD E Baltimore
443 MD E Baltimore
667 MD E Baltimore
339 MA E Lynn
351 MA E Lowell
413 MA E Springfield
508 MA E Worcester
617 MA E Boston
774 MA E Worcester
781 MA E Lynn
857 MA E Boston
978 MA E Lowell
231 MI DET Muskegon
248 MI DET Troy
269 MI DET Kalamazoo
313 MI DET Detroit
517 MI DET Lansing
586 MI DET Warren
616 MI DET Grand Rapids
679 MI DET Detroit
734 MI DET Ann Arbor
810 MI DET Flint
906 MI DET* Marquette
947 MI DET Troy
989 MI DET Saginaw
218 MN C Duluth
320 MN C St. Cloud
507 MN C Rochester
612 MN C Minneapolis
651 MN C St. Paul
763 MN C Brooklyn Park
924 MN C Rochester
952 MN C Bloomington
228 MS C Gulfport
601 MS C Jackson
662 MS C Tupelo
769 MS C Jackson
235 MO C Columbia
314 MO C St. Louis
417 MO C Springfield
557 MO C St. Louis
573 MO C Columbia
636 MO C St. Charles
660 MO C Sedalia
816 MO C Kansas City
975 MO C Kansas City
406 MT M Billings
308 NE C* Grand Island
402 NE C Omaha
531 NE C Omaha
702 NV P Las Vegas
725 NV P Las Vegas
775 NV P Reno
603 NH E Manchester
201 NJ E Jersey City
551 NJ E Jersey City
609 NJ E Trenton
640 NJ E Trenton
732 NJ E New Brunswick
848 NJ E New Brunswick
856 NJ E Camden
862 NJ E Newark
908 NJ E Elizabeth
973 NJ E Newark
505 NM M Albuquerque
575 NM M Las Cruces
212 NY E New York City (Manhattan)
315 NY E Syracuse
329 NY E Poughkeepsie
332 NY E New York City (Manhattan)
347 NY E New York City
363 NY E Long Island (Nassau)
516 NY E Long Island (Nassau)
518 NY E Albany
585 NY E Rochester
607 NY E Binghamton
624 NY E Buffalo
631 NY E Long Island (Suffolk)
646 NY E New York City (Manhattan)
680 NY E Syracuse
716 NY E Buffalo
718 NY E New York City
838 NY E Albany
845 NY E Poughkeepsie
914 NY E Yonkers
917 NY E New York City
929 NY E New York City
934 NY E Long Island (Suffolk)
252 NC E Greenville
336 NC E Greensboro
472 NC E Fayetteville
704 NC E Charlotte
743 NC E Greensboro
828 NC E Asheville
910 NC E Fayetteville
919 NC E Raleigh
980 NC E Charlotte
984 NC E Raleigh
701 ND C* Fargo
216 OH E Cleveland
220 OH E Newark
234 OH E Akron
283 OH E Cincinnati
326 OH E Dayton
330 OH E Akron
380 OH E Columbus
419 OH E Toledo
436 OH E Cleveland
440 OH E Parma
513 OH E Cincinnati
567 OH E Toledo
614 OH E Columbus
740 OH E Newark
937 OH E Dayton
405 OK C Oklahoma City
539 OK C Tulsa
572 OK C Oklahoma City
580 OK C Lawton
918 OK C Tulsa
458 OR P Eugene
503 OR P Portland
541 OR P* Eugene
971 OR P Portland
215 PA E Philadelphia
223 PA E Lancaster
267 PA E Philadelphia
272 PA E Scranton
412 PA E Pittsburgh
445 PA E Philadelphia
484 PA E Allentown
570 PA E Scranton
582 PA E Erie
610 PA E Allentown
717 PA E Harrisburg
724 PA E New Castle
814 PA E Erie
835 PA E Allentown
878 PA E Pittsburgh
401 RI E Providence
803 SC E Columbia
821 SC E Greenville
839 SC E Columbia
843 SC E Charleston
854 SC E Charleston
864 SC E Greenville
605 SD C* Sioux Falls
423 TN E* Chattanooga
615 TN C Nashville
629 TN C Nashville
729 TN E* Chattanooga
731 TN C Jackson
865 TN E Knoxville
901 TN C Memphis
931 TN C* Clarksville
210 TX C San Antonio
214 TX C Dallas
254 TX C Waco
281 TX C Houston
325 TX C Abilene
346 TX C Houston
361 TX C Corpus Christi
409 TX C Beaumont
430 TX C Tyler
432 TX C* Midland
469 TX C Dallas
512 TX C Austin
682 TX C Fort Worth
713 TX C Houston
726 TX C San Antonio
737 TX C Austin
806 TX C Lubbock
817 TX C Fort Worth
830 TX C New Braunfels
832 TX C Houston
903 TX C Tyler
915 TX M El Paso
936 TX C Conroe
940 TX C Denton
945 TX C Dallas
956 TX C Laredo
972 TX C Dallas
979 TX C Bryan
385 UT M Salt Lake City
435 UT M St. George
801 UT M Salt Lake City
802 VT E Burlington
276 VA E Bristol
434 VA E Charlottesville
540 VA E Roanoke
571 VA E Arlington
703 VA E Arlington
757 VA E Virginia Beach
804 VA E Richmond
826 VA E Roanoke
948 VA E Virginia Beach
206 WA P Seattle
253 WA P Tacoma
360 WA P Vancouver
425 WA P Bellevue
509 WA P Spokane
564 WA P Olympia
304 WV E Charleston
681 WV E Charleston
262 WI C Kenosha
274 WI C Green Bay
353 WI C Madison
414 WI C Milwaukee
534 WI C Eau Claire
608 WI C Madison
715 WI C Eau Claire
920 WI C Green Bay
307 WY M Cheyenne
787 PR PR San Juan
939 PR PR San Juan
340 VI PR St. Thomas
671 GU GU Hagatna
670 MP MP Saipan
684 AS AS Pago Pago
368 AB EDM Calgary
403 AB EDM Calgary
587 AB EDM Calgary
780 AB EDM Edmonton
825 AB EDM Edmonton
236 BC VAN Vancouver
250 BC VAN* Victoria
257 BC VAN Vancouver
604 BC VAN Vancouver
672 BC VAN Vancouver
778 BC VAN Vancouver
204 MB WIN Winnipeg
431 MB WIN Winnipeg
584 MB WIN Winnipeg
428 NB MON Moncton
506 NB MON Moncton
709 NL NL St. John's
879 NL NL St. John's
782 NS HAL Halifax
902 NS HAL Halifax
226 ON TOR London
249 ON TOR Sudbury
289 ON TOR Hamilton
343 ON TOR Ottawa
365 ON TOR Hamilton
382 ON TOR London
416 ON TOR Toronto
437 ON TOR Toronto
519 ON TOR London
548 ON TOR London
613 ON TOR Ottawa
647 ON TOR Toronto
683 ON TOR Sudbury
705 ON TOR Sudbury
742 ON TOR Hamilton
753 ON TOR Ottawa
807 ON TOR* Thunder Bay
905 ON TOR Hamilton
942 ON TOR Toronto
263 QC TOR Montreal
354 QC TOR Laval
367 QC TOR Quebec City
418 QC TOR Quebec City
438 QC TOR Montreal
450 QC TOR Laval
468 QC TOR Sherbrooke
514 QC TOR Montreal
579 QC TOR Laval
581 QC TOR Quebec City
819 QC TOR Sherbrooke
873 QC TOR Sherbrooke
306 SK REG Regina
474 SK REG Regina
639 SK REG Regina
867 YT WH* Whitehorse
`;

// code -> { code, state, stateName, city, timeZone, splitZone }
export const AREA_CODES = {};

RAW_AREA_CODES.trim().split("\n").forEach(line => {
    const [code, state, zoneKey, ...cityWords] = line.trim().split(/\s+/);
    const splitZone = zoneKey.endsWith("*");
    const timeZone = AREA_CODE_ZONES[zoneKey.replace("*", "")];

    AREA_CODES[code] = {
        code,
        state,
        stateName: STATE_NAMES[state] || state,
        city: cityWords.join(" "),
        timeZone,
        splitZone
    };
});

export function lookupAreaCode(areaCode) {
    return AREA_CODES[areaCode] || null;
}
