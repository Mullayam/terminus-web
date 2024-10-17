export interface FileType {
    name: string;
    dateModified: string;
    size: string;
    kind: string;
}
export type Files =  FileType[]