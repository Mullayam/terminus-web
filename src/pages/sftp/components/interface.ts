export interface FileType {
    name: string;
    dateModified: string;
    size: string;
    kind: string;
}
export type Files =  FileType[]

export interface SFTP_FILES_LIST {
    accessTime: number
    group: number
    longname: string
    modifyTime: number
    name: string
    owner: number
    rights: Rights
    size: number
    type: string
}

interface Rights {
    group: string
    other: string
    user: string
}

export type  RIGHT_CLICK_ACTIONS  = "refresh" |"copy" | "move" | "delete" | "rename" | "download" | "upload" | "properties" | "createFolder" |"createFile" |"edit"