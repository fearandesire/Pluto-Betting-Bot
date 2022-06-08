<h1> v.05  </h1>

# :computer: Main Summary

+ Embed Response for Matchups list (SendMatchupList)[./SendMatchupList.js]
    - Sort collected matchups for displaying (SortGatheredOdds)[./utils/SortGatheredOdds.js]
+ Collect/Gather all matchups/odds cmd (gatherOdds.js)[./commands/gatherOdds.js]
+ Collect/Gather odds for specific team & their matchup cmd (odds.js)[./commands/odds.js]
+ Established Bot on Discord


# :penguin: Kowalski Summary (detailed)
+ Container that is used to verify if the (daily odds have already been collected.)[./commands/gatherOdds.js] Used to not repeat the operation & duplicate the list info // unnecessary API calls.
+ Function to add the '+'to the odds. Aka (determine if the odds retrieved are a positive number)[./utils/AddPlusToPositive.js]
+ Function to determine (odd or even)[./utils/OddOrEven.js] index
+ Added/edited commenting to most needed areas
+ Established API Calls & the API structure