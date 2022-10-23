import { Listener } from '@sapphire/framework'
import { SapDiscClient } from '#main'
import { cyan } from 'colorette'

const logthis = console.log
export class CommandDeniedListener extends Listener {
    run(error, { message }) {
        message.channel.send('You are not allowed to use this command.')
        logthis(cyan('~~~~ (Unauthorized) Command used by: ~~~~'))
        console.log(message.author.username)
        console.log(' ')
        console.log('Users ID: ')
        console.log(SapDiscClient.user.id)
        logthis(cyan('~~~~       ~~~~'))
    }
}
