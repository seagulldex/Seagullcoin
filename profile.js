// In models/profile.js
export const Profile = (sequelize, DataTypes) => {
  const Profile = sequelize.define('Profile', {
    walletAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  return Profile;
};
