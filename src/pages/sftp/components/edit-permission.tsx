import React from 'react';
import { useForm } from 'react-hook-form';
import { SFTP_FILES_LIST } from './interface';
import { convertToPermissions } from '@/lib/utils';

export interface PermissionFormData {

  owner: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  groups: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  others: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };

}

export function FilePermissions({ data }: { data: SFTP_FILES_LIST }) {
  const perm = convertToPermissions(data.rights)
  const { register } = useForm<PermissionFormData & {
    user: string | number,
    group: string | number
  }>({
    defaultValues: {
      ...perm,
      user: data.owner,
      group: data.group
    }
  });
 
  

  return (
    <div className="p-4 animate-in fade-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{
            data.type === "d" ? "Folder" : "File"
          } Permissions</h2>
         
        </div>

        <div className="mb-6">             

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">File Access</div>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-400">
                      <th className="pb-2 w-1/4"></th>
                      <th className="pb-2">Read</th>
                      <th className="pb-2">Write</th>
                      <th className="pb-2">Execute</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="py-2">Owner</td>
                      <td><input type="checkbox" {...register('owner.read')} className="rounded bg-gray-700 border-gray-600" /></td>
                      <td><input type="checkbox" {...register('owner.write')} className="rounded bg-gray-700 border-gray-600" /></td>
                      <td><input type="checkbox" {...register('owner.execute')} className="rounded bg-gray-700 border-gray-600" /></td>
                    </tr>
                    <tr>
                      <td className="py-2">Groups</td>
                      <td><input type="checkbox" {...register('groups.read')} className="rounded bg-gray-700 border-gray-600" /></td>
                      <td><input type="checkbox" {...register('groups.write')} className="rounded bg-gray-700 border-gray-600" /></td>
                      <td><input type="checkbox" {...register('groups.execute')} className="rounded bg-gray-700 border-gray-600" /></td>
                    </tr>
                    <tr>
                      <td className="py-2">Others</td>
                      <td><input type="checkbox" {...register('others.read')} className="rounded bg-gray-700 border-gray-600" /></td>
                      <td><input type="checkbox" {...register('others.write')} className="rounded bg-gray-700 border-gray-600" /></td>
                      <td><input type="checkbox" {...register('others.execute')} className="rounded bg-gray-700 border-gray-600" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Ownership</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">User</label>
                    <input
                      type="text"
                      {...register('user')}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Group</label>
                    <input
                      type="text"
                      {...register('group')}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
    </div>
  );
}