Read the readme file for this https://github.com/enjoys-in/context-engine

and it ask for package intasll  but dont instead use this 
Base-> https://cdn.jsdelivr.net/npm
Package name -> @enjoys/context-engine
Full url for completion, hover,definations ->https://cdn.jsdelivr.net/npm/@enjoys/context-engine/data/manifest.json
ResponseSchema :  export interface Root {
  version: string
  description: string
  generatedAt: string
  languages: Language[]
  directories: Directories
  totalLanguages: number
  totalFiles: number
}

export interface Language {
  id: string
  name: string
  files: Files
}

export interface Files {
  completion: string
  defination: string
  hover: string
}

export interface Directories {
  completion: Completion
  defination: Defination
  hover: Hover
}

export interface Completion {
  description: string
  files: string[]
}

export interface Defination {
  description: string
  files: string[]
}

export interface Hover {
  description: string
  files: string[]
}



Full url for terminal commands ->https://cdn.jsdelivr.net/npm/@enjoys/context-engine/data/manifest.json
ResponseSchema:
export interface Root {
  files: any[]
  context: Context[]
}

export interface Context {
  category: string
  context: string[]
  files: string[]
}


 you have to add plugin thing like extenstion where user can be default see for sftp what are the language available  if user select any language then fetch its hover,completions,defination and store them into index db using `https://cdn.jsdelivr.net/npm/@enjoys/context-engine` url  
 for example, using manifest.json
 
"languages": [
{
"id": "awk",
"name": "Awk",
"files": {
"completion": "completion/awk.json",
"defination": "defination/awk.json",
"hover": "hover/awk.json"
}
},
]
langues is bash, filter languages.id bash id/name then files has completion,defination,hover
 adding into url completion -> https://cdn.jsdelivr.net/npm/@enjoys/context-engine/data/completion/awk.json
 defination-> baseurl/data/defination/awk.json
hover-> baseurl/data/defination/awk.json

also show section for terminal commands in plugin 
{
"files": [],
"context": [
    {
"category": "☁️ Cloud CLIs",
"context": [
"Logged-in account",
"Active project",
"Regions",
"Services",
"Deployed apps",
"Buckets",
"Databases"
],
"files": [
"aws.json",
"aws-vault.json",
"gcloud.json",
"az.json",
"doctl.json",
"linode-cli.json",
"vercel.json",
"netlify.json",
"cloudflare.json",
"firebase.json",
"supabase.json",
"railway.json",
"render.json",
"flyctl.json"
]
},
]
}
use context to show as group wise show category name then small text,context  and when user click show files it will load this files  and and user click on install then install those files do parallel api and store them in index db in diffren data base for dexie


 and add ghost suggestion in sftp terminal with these command  also suggestion box like we did in ssh terminal , take refrence from them
 make sure its theme compatible whatever theme user choses


 