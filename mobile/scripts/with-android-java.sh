#!/bin/sh
set -eu

if [ -x /opt/homebrew/opt/openjdk@21/bin/java ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21
elif [ -x /opt/homebrew/opt/openjdk@17/bin/java ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17
elif [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  :
elif [ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
else
  echo "ResQNet Android builds require JDK 17 or 21." >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

exec "$@"
