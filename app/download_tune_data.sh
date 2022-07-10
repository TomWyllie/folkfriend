# The app uses a local copy of the files nud-meta.json and folkfriend-non-user-data.json rather than pulling from the bucket.
#	This can be useful for debugging but also just saves hammering the bandwidth quota when doing lots of debugging.
#	This script should be run once to sync the local copies of these files with the version hosted online.
mkdir -p public/res/
cd public/res/

# Data lives in a completely separate Firebase project.
wget https://folkfriend-app-data.web.app/nud-meta.json
wget https://folkfriend-app-data.web.app/folkfriend-non-user-data.json

cd -

