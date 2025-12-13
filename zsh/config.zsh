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

# Source - https://stackoverflow.com/a
# Posted by Joe the Person, modified by community. See post 'Timeline' for change history
# Retrieved 2025-12-14, License - CC BY-SA 4.0

autoload -U colors && colors
PS1="%{$fg[red]%}%n%{$reset_color%}@%{$fg[blue]%}%m %{$fg[yellow]%}%~ %{$reset_color%}%% "

