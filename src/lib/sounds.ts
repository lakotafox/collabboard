// Lazy-loaded sound effects — created on first play to avoid browser autoplay restrictions

let buttonClick: HTMLAudioElement | null = null
let joinBoard: HTMLAudioElement | null = null
let userJoined: HTMLAudioElement | null = null

export function playButtonClick() {
  if (!buttonClick) {
    buttonClick = new Audio('/sounds/button-click.mp3')
    buttonClick.volume = 0.4
  }
  buttonClick.currentTime = 0
  buttonClick.play().catch(() => {})
}

export function playJoinBoard() {
  if (!joinBoard) {
    joinBoard = new Audio('/sounds/join-board.mp3')
    joinBoard.volume = 0.5
  }
  joinBoard.currentTime = 0
  joinBoard.play().catch(() => {})
}

export function playUserJoined() {
  if (!userJoined) {
    userJoined = new Audio('/sounds/user-joined.wav')
    userJoined.volume = 0.4
  }
  userJoined.currentTime = 0
  userJoined.play().catch(() => {})
}
