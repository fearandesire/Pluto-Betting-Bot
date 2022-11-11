<h1 align="center">
About Pluto
</h1>

Pluto is a multi-sport betting bot with a strong focus on simplicity. Users are able to securely place bets and particpate in the online betting scene without using real-life currency. Pluto utilizies an API _([the-odds-api](the-odds-api.com/))_ & secure SQL Databases to ensure that we consistently deliver accurate odds as well as smooth, worry-free redemption of bets.

Pluto is one of the largest projects I have been grateful to work on to date. This page is dedicated to describing my experience developing Pluto, the technologies used and the challenges I faced during the process.

## :brain: Planning

From the start, Pluto was mapped out visually with [draw.io](http://draw.io) - A flowchart/diagram website. I used this with an early collaborator @Faysal19999 to map out the entire project. This allowed us to visualize the entire project and plan out the steps we needed to take to get to the end goal, while also pointing out potential issues. Technologies were identified, as well as database schemas to meet the needs. This was a great way to get started.

It was clear from the start that since Pluto would be serving 200,000+ users, we would need everything to be on point. Efficient, easy to use and maintain.

Most importantly, it was key for this to be autonomous, and a hands-off experience for the server admins, as well as the users. This meant that the focus would be on creating a seamless day-to-day transition between the database, the API and the bot itself.

## :wrench: Development

Once planning and technologies were done and determined (Node.js, PostgreSQL for the database, and the-odds-api for the odds), development began. The database was setup, as well as the package to simplify Pluto's connection to it: [pg-promise](https://www.npmjs.com/package/pg-promise). This allowed Pluto to create a connection pool, which would allow it to connect to the database and run queries without having to worry about the connection being closed. This was a huge step in the right direction, as it would greatly assist in performing a sequence of transactions/queries to the database without effecting the performance of the bot.

After the database we setup, the initial commands were arranged as well as functions to compliment them and communicate with the database and API. Initially, a cache system was being used to create backups of odds and bets. This was from the fear of the database being unable to handle the potential load of queries. However, after testing, it was clear that the database was able to handle a substantial amount of queries without troubling the performance, and the cache system was removed. Backups are now performed automatically by the database itself.

Some problems were sourced from overcomplicating simple procedures. For example, the process of closing bets was initially drawn out into a lengthy, crowded set of functions. Another example was the cache system as mentioned prior, which was made to be too convuluted for a simple task. These were fixed by simplifying the code, making it more readable, thereby making it easier to maintain and update. Other issues that were not spotted in the initial stages of planning were uncovered through time. An example of such would be the fact of unique, constraint keys for the database entries. Functions _were_ set up to create unique keys, however, there was no check to verify if the key generated was in fact already existing or not, leading to errors when querying the database and attempting to insert the information.

Over time, ways to improve the user experience as well as create easier methods of what was needed were established. The date system, which is used to check for game's currently active to prevent cheating on bets as well as scheduling them was initially off of the base JavaScript date method. Now, Pluto uses [date-fns](htt://date-fns.org/) to efficiently handle all date and time information needed. This was a massive improvement as it allowed for flexibility, as well as provided more solutions to enhance the user experience, such as letting the user know how much time they have left before they can use their daily claim of free money.

Currently, Pluto is serving two of the largest Sports Discord Servers (NFL & NBA Chat)
Pluto is a staple in both communities where it is used daily by hundreds, featuring everything you would expect. The codebase itself is in the process of being refactored to be more efficient, as well as more readable.
