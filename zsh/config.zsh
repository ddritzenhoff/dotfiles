export NVM_DIR="$HOME/.nvm"
  [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"  # This loads nvm
  [ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion
export PATH="$PATH:$(go env GOPATH)/bin"
export PATH="$PATH:$HOME/Library/Python/3.9/bin"
export EDITOR=nvim
export VISUAL="$EDITOR"
export GPG_TTY=$(tty)

alias hss='hugo server --noHTTPCache'
alias pip=pip3
alias gr='rg'
alias g='rg'
alias grep='grep --color=auto'
alias less='less -R'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias path='echo -e ${PATH//:/\\n}'
alias mkdir='mkdir -pv'
alias df='df -h'
alias ..='cd ..'

