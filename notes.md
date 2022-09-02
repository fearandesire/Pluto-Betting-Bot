- Bet Odds can be retrieved when closing all bets from activematchups

Closing Bets Function:

select all rows containing winning team
apply currency (math of bet) to each user that bet on the winning team
copy rows into archivebets table
delete rows from original table

For now:

Close one bet individual cmd & function to exercise/learn ability to do above

Betting Math/Info:

Are Negative or Positive Odds Better? Negative numbers are reserved for the favorite on the betting line and indicate how much you need to stake to win $100. Conversely, positive numbers are attached to the underdog and refer to the amount you could win if you bet $100.

    /**
    	 * Desired Function: Cancel Bet
    	 [√] 1: We want to make sure the user has an active bet.
         [√] 1.5: We need to make sure the bet the user is trying to cancel is actually theirs.
         [√] 1.6: We need to make sure the bet the user is trying to cancel is actually active.
    	 [√] 2: We want to delete the bet from the array containing their active bets.
    	 [√] 3: We need to delete the bet from the database [betslips]
    	 [!] 3.5: We need to restore the balance from the cancelled bet to the users balance.
    	 [√] 4: If the array is empty, we need to delete the user from 'activebets' table in the database - as the user would have no bets.
    	 */

}

/\*\* Cancel Bet Logic & How it ties into 'listBets':
When a user views their bets via 'listBets', we compile their bets from the DB into an object and store said information into local storage.
This is relevant for the 'cancelBet' command because we will need to edit the local storage object to remove the bet the user wants to cancel.
Reason being: if the user uses 'listBets' at any point after using 'sortCancelBet', we need the embed response to reflect the updated bets for them.

\*\*/

- Deleting / Closing a bet will update the user's balance accordingly.
