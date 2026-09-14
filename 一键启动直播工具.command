#!/bin/zsh
cd /Volumes/M2USB/Projects/ai-live-studio || exit 1
/opt/homebrew/bin/node scripts/live-control.mjs start
printf '\n按回车关闭此窗口…'
read
