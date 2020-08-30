const Discord = require('discord.js');
const fs = require('fs');

const client = new Discord.Client();
const prefix = "snake/";
let games = [];
const BOARD_SIZE = 13;
const emebdColor = "#32a852";
let highscores = JSON.parse(fs.readFileSync('highscores.json'));

class Game {
  constructor(player, message) {
    this.player = player;
    this.board = [];
    this.boardMessage = message;
    this.row = 6;
    this.col = 4;
    this.body = [{row: this.row, col: this.col-1}, {row: this.row, col: this.col}];
    this.direction = "";
    this.applePos = {row: 6, col: 9}
    this.best = highscores[this.player.id];
    //this.interval;
    for (let r=0; r<BOARD_SIZE; r++) {
      this.board.push([]);
      for (let c=0; c<BOARD_SIZE; c++) {
        this.board[r].push(0);
      }
    }
    this.boardMessage.react("◀")
    .then(() => this.boardMessage.react("🔼"))
    .then(() => this.boardMessage.react("🔽"))
    .then(() => this.boardMessage.react("▶"))
    .catch(() => console.error("Could not add reactions"))
  }

  spawnApple() {
    // Need to prevent apples from spawing where the snake is
    this.applePos.row = Math.floor(Math.random() * BOARD_SIZE);
    this.applePos.col = Math.floor(Math.random() * BOARD_SIZE);
    if (this.applePos.row == this.row && this.applePos.col == this.col) {
      return this.spawnApple();
    }
  }

  gameOver() {
    if (this.row >= BOARD_SIZE || this.row < 0) {
      return true;
    }
    if (this.col >= BOARD_SIZE || this.col < 0) {
      return true;
    }
    return false;
  }

  move() {
    let end;
    if (this.direction) {
      end = this.body.shift();
    }
    //Move snake in correct direction
    if (this.direction == "right") {
      this.body.push({row: this.row, col: this.col+1});
      this.col++;
    }
    if (this.direction == "left") {
      this.body.push({row: this.row, col: this.col-1});
      this.col--;
    }
    if (this.direction == "up") {
      this.body.push({row: this.row-1, col: this.col});
      this.row--;
    }
    if (this.direction == "down") {
      this.body.push({row: this.row+1, col: this.col});
      this.row ++;
    }

    if (this.row == this.applePos.row && this.applePos.col == this.col) {
      this.spawnApple();
      // Add segment to end of snake
      this.body.unshift(end)
    }
  }

  update() {

    // Reset board
    for (let r=0; r<BOARD_SIZE; r++) {
      for (let c=0; c<BOARD_SIZE; c++) {
        this.board[r][c] = 0;
      }
    }

    // Add snake body and apple to board for display purposes
    this.board[this.applePos.row][this.applePos.col] = 2;
    this.body.forEach(i => {
      this.board[i.row][i.col] = 1;
    });

    let boardText = "";
    for (let r=0; r<BOARD_SIZE; r++) {
      for (let c=0; c<BOARD_SIZE; c++) {
        // let tile = 0;
        // if (this.applePos.row == r && this.applePos.col == c) { tile = 2; }
        // for (let i=0; i<this.body.length; i++) {
        //   if (this.body[i].row == r && this.body[i].col == r) { tile = 1; }
        // }

        if (this.board[r][c] == 0) {
          boardText += "🟩";
        } else if (this.board[r][c] == 1) {
          boardText += "🟦";
        } else if (this.board[r][c] == 2) {
          boardText += "🟥"
        }
      }
      boardText += "\n";
    }
    this.boardMessage.edit("");
    this.boardMessage.edit(
      new Discord.MessageEmbed()
      .setColor(emebdColor)
      .setTitle(`${this.player.username}'s Game`)  //.setTitle(`Score: ${this.body.length}\nHigh Score: ${25}`)
      .addFields(
        {name: "Score", value: this.body.length-2, inline: true},
        {name: "High Score", value: `${this.best>this.body.length-2 ? this.best : this.body.length-2}`, inline: true}
      )
      .setDescription(boardText)
    );
  }

  saveScore() {
    if (highscores[this.player.id] < this.body.length-2) {
      highscores[this.player.id] = this.body.length-2;
      fs.writeFileSync('highscores.json', JSON.stringify(highscores));
    }
  }
}

client.on('ready', () => {
  console.log('Snakebot is running');
});

client.on('messageReactionAdd', (reaction, user) => {
  for (let i=0; i<games.length; i++) {
    if (user.bot) { return; }
    if (games[i].boardMessage.id == reaction.message.id && games[i].player.id == user.id) {
      if (reaction.emoji.name == "◀" && games[i].direction != "right") { games[i].direction = "left"; }
      if (reaction.emoji.name == "▶" && games[i].direction != "left") { games[i].direction = "right"; }
      if (reaction.emoji.name == "🔼" && games[i].direction != "down") { games[i].direction = "up"; }
      if (reaction.emoji.name == "🔽" && games[i].direction != "up") { games[i].direction = "down"; }
      games[i].move();
      if (games[i].gameOver()) {
        endGameSequence(i);
        break;
      }
      games[i].update();
      const userReactions = reaction.message.reactions.cache.filter(r => r.users.cache.has(games[i].player.id));
      try {
      	for (const r of userReactions.values()) {
      		r.users.remove(games[i].player.id);
      	}
      } catch (error) {
        console.error('Failed to remove reactions.');
        console.error(error);
      }
    }
  }
});

// Create an event listener for messages
client.on('message', message => {
  if (!message.content.startsWith(prefix)) { return; }
  //console.log(games);
  const command = message.content.substring(prefix.length).toLowerCase();
  if (command === "start") {
    let alreadyInGame = false;
    games.forEach(g => {
      if (g.player == message.author) {
        alreadyInGame = true;
        message.channel.send("You are already in a game. To exit the game, use the `"+prefix+"exit` command");
      }
    });
    if (!alreadyInGame) {
      message.channel.send(new Discord.MessageEmbed().setColor(emebdColor)).then(sentMessage => {
        let game = new Game(message.author, sentMessage)
        games.push(game);
        //console.log(sentMessage);
        game.update();
      });
    }
  }
  else if (command == "exit") {
    let inGame = false;
    for (let i=0; i<games.length; i++) {
      if (games[i].player.id == message.author.id) {
        inGame = true;
        endGameSequence(i);
        break;
      }
    }
    if (!inGame) {
      message.channel.send("You are not currently in a game. To start a game, use the `"+prefix+"start` command.");
    }
  }
  else if (command == "leaderboard") {
    let topScores = [];
    for (const id in highscores) {
      topScores.push({id: id, score: highscores[id]});
    }
    //console.log(topScores);
    topScores.sort((a, b) => {
      if (a.score < b.score) {
        return 1;
      }
      if (a.score > b.score) {
        return -1;
      }
      return 0;
    });
    //console.log(topScores);
    let topScoresStr = "";
    showLeaderBoard(topScores, message)
  }
  else if (command == "help" || command == "info") {
    message.channel.send(
      new Discord.MessageEmbed()
      .setColor(emebdColor)
      .setTitle("Snakebot")
      .setDescription("This is a fun little bot that lets you play the classic game of snake inside of Discord! (It's really more of a patience test because of how laggy it is.)")
      .addFields(
        {name: "Commands", value: "`"+prefix+"start` starts a new game\n`"+prefix+"exit` exits the current game\n`"+prefix+"leaderboard` displays the top scores"},
        {name: "Other Information", value: "▫Made with discord.js\n▫Source code: https://github.com/mthomas24/Discord-Snake-Bot"}
      )
      .setFooter("Created by JellyOnToast1#2710")
    )
  }
  else if (command == "admin savescores" && message.author.id == "448269422814298112") {
    fs.writeFileSync('highscores.json', JSON.stringify(highscores));
    message.channel.send("High scores saved.");
  }
  else {
    message.channel.send("Use the `"+prefix+"info` command for information about this bot.");
  }
});

function endGameSequence(i) {
  games[i].saveScore();
  games[i].boardMessage.delete();
  if (games[i].body.length-2 != 0) {
    games[i].boardMessage.channel.send(
      new Discord.MessageEmbed()
      .setColor(games[i].body.length-2 > games[i].best ? "#34c771" : "#c92424")
      .setTitle("Game Over")
      .setDescription(games[i].body.length-2 > games[i].best ? "You set a new high score!" : `You didn't beat your high score of ${games[i].best}. Better luck next time!`)
      .addField("Score", games[i].body.length-2 + "")
    );
  }
  
  games.splice(i, 1);
}

function showLeaderBoard(topScores, message) {
  let topScoresStr = "";
  client.users.fetch(topScores[0].id).then(user => {
    topScoresStr += "**1. **"+user.username+"#"+user.discriminator+": "+topScores[0].score+"\n";
    client.users.fetch(topScores[1].id).then(user => {
      topScoresStr += "**2. **"+user.username+"#"+user.discriminator+": "+topScores[1].score+"\n";
      client.users.fetch(topScores[2].id).then(user => {
        topScoresStr += "**3. **"+user.username+"#"+user.discriminator+": "+topScores[2].score;

        message.channel.send(
          new Discord.MessageEmbed()
          .setColor("#e8da3a")
          .setTitle("Leaderboard")
          .addFields(
            {name: "Top Scores", value: topScoresStr},
            {name:"Your High Score", value: highscores[message.author.id] ? highscores[message.author.id] : "-"}
          )
        );

      });
    });
  });
}

fs.readFile("token.txt", "utf8", (err, data) => {
  const token = data;
  client.login(token);
});
