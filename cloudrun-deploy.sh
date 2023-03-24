PROJECT_ID="dazai-method"

gcloud builds submit --config=cloudbuild.yaml --project $PROJECT_ID

if [ $? = 0 ]; then
  gcloud run deploy $PROJECT_ID --image gcr.io/$PROJECT_ID/webapp --project $PROJECT_ID --region asia-northeast1
fi
