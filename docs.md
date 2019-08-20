     MASTER
     ^   ^
     |   |
     |   |
     A   B


Hey, almost done with the ZFS part, later today I have a chat with mike to setup the EC2 instance and start playing around with NFS. There is one thing I am not sure about: assuming we have more than one PR open, then we have several zfs-branches pointing to the master cache. As soon as one of them is merged, what should happen to the other branches?
Im not sure if at this step we should delete all the dangling branches.
Keep in mind that atm the CI forces us to rebase every PR on top of master, so as soon as a merge happens, all the other PRs need rebasing.
With this in mind I think it could make sense to delete them right away, its true that you loose everything that was added to the cache from your PR, but you also get access to what was added in the PR that go merged.
What do you think?
