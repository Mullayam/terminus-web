import React from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';

interface PermissionFormData {
  path: string;
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
  user: string;
  group: string;
}

export function FilePermissions() {
  const { register, handleSubmit } = useForm<PermissionFormData>({
    defaultValues: {
      path: '/home/ubuntu',
      owner: { read: true, write: true, execute: true },
      groups: { read: true, write: true, execute: true },
      others: { read: true, write: false, execute: true },
      user: 'ubuntu',
      group: 'ubuntu'
    }
  });

  const onSubmit = (data: PermissionFormData) => {
    console.log(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full p-8 max-w-md bg-[#1c1e26] rounded-lg shadow-xl animate-in slide-in-from-bottom-4 duration-300">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Edit permissions</h2>
          <button className="text-gray-400 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-2">{'/home/ubuntu'}</div>

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

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}