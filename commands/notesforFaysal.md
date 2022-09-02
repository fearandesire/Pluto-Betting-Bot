---
noteId: "b7e6c7b02b0111eda4b07961458fe194"
tags: []

---

<!--
​‌‌‍⁡⁢⁢⁢𝗡𝗼𝘁𝗲𝘀:​⁡
If curious about any database related functions, take a look through our current files on how they work
Pay close attention to how we return data, and the differences between functions such as .oneOrNone, .any, .tx
and how we use promises to return info [placebet.js](placebet.js) is a good example
-->

<!--
I have uninstalled Beautify as it is deprecated, and working with Prettier. I almost insist you download it ->
and set up Prettier settings / VSCode settings to Format On Save (formatOnSave setting) to ensure consistency with our coding visually
I have setup a Prettier NPM package, so ⁡⁢⁣⁢𝗯𝗲 𝘀𝘂𝗿𝗲 𝘁𝗼 𝘁𝘆𝗽𝗲 `𝗻𝗽𝗺 𝗶` 𝗮𝗳𝘁𝗲𝗿 𝗽𝘂𝗹𝗹𝗶𝗻𝗴 𝗳𝗿𝗼𝗺 𝗳𝗮𝘆𝗳𝗲𝗻𝗶𝘅𝘁𝗲𝘀𝘁𝗶𝗻𝗴.⁡
-->

​‌‌‌‍⁡⁣⁣⁢𝗧𝗢𝗗𝗢:⁡​

[ ] Setup GitHub Issues & Project with TODO list [both the one here & todo.md]

[√] Create Matchup command & function: {

[√] - createMatchup command
[√] - Store matchup information (team one, team two, and odds for both in activematchups table) [separate function called in cmd] - Return successful notification to the user - bonus points for returning a successful response as an embed
[ ] - Validate: If it already exists in the DB, throw an error.
}
[√] Create Command List function
[ ] 'Register' command & function -> a command that will create the user in the DB
[ ] - createuser function - query DB and store their userid in the database (Balance Column has a default entry of 100 now, so it is not required to input, but you can if wanted) - An example of this process exists within [processClaim.js](../utils/cmd_res/processClaim.js)
[ ] - Reject Register command from existing user [isExistingUser.js](../utils/cmd_res/isExistingUser.js)
[ ] Leaderboard
[ ] Give Currency

<!--
Rejecting new users and forcing them to create a profile will help not overload our commands & database with numerious queries
Otherwise, almost every command will not only require to verify if a user is existing, but also creating the user if they do not.
It is of course possible to just create the user if they are new, but I am concerned about the query-chain messing up with high-usage
And for example, a bet being processed before it could create the user, even though it is scripted to wait.
-->

[ ] Reject users who are new to the bot from using placebet // betting [placebet.js](placebet.js)
[ ] - Re-direct / Respond to new users that they must first Register with the bot first.
[ ] Outline ways to reduce queries for betting, or overall [placing a bet commits 6 queries, I believe]
