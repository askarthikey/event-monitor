const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class VideoUploadService {
  /**
   * Upload video file to Supabase storage
   * @param {Buffer} fileBuffer - The video file buffer
   * @param {string} fileName - Original file name
   * @param {string} mimeType - File MIME type
   * @returns {Promise<string>} - Public URL of uploaded video
   */
  static async uploadVideo(fileBuffer, fileName, mimeType) {
    try {
      // Generate unique filename
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `event-videos/${uniqueFileName}`;

      // Upload file to Supabase storage
      const { data, error } = await supabase.storage
        .from('videos') // Make sure you create this bucket in Supabase
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: false
        });

      if (error) {
        console.error('Error uploading video to Supabase:', error);
        throw new Error('Failed to upload video');
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Video upload service error:', error);
      throw error;
    }
  }

  /**
   * Upload image file to Supabase storage
   * @param {Buffer} fileBuffer - The image file buffer
   * @param {string} fileName - Original file name
   * @param {string} mimeType - File MIME type
   * @returns {Promise<string>} - Public URL of uploaded image
   */
  static async uploadImage(fileBuffer, fileName, mimeType) {
    try {
      // Generate unique filename
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `event-images/${uniqueFileName}`;

      // Upload file to Supabase storage
      const { data, error } = await supabase.storage
        .from('images') // Make sure you create this bucket in Supabase
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: false
        });

      if (error) {
        console.error('Error uploading image to Supabase:', error);
        throw new Error('Failed to upload image');
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Image upload service error:', error);
      throw error;
    }
  }

  /**
   * Delete video from Supabase storage
   * @param {string} videoUrl - Public URL of the video to delete
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteVideo(videoUrl) {
    try {
      // Extract file path from URL
      const urlParts = videoUrl.split('/');
      const filePath = urlParts.slice(-2).join('/'); // Get 'event-videos/filename.ext'

      const { error } = await supabase.storage
        .from('videos')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting video from Supabase:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Video deletion service error:', error);
      return false;
    }
  }

  /**
   * Delete image from Supabase storage
   * @param {string} imageUrl - Public URL of the image to delete
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteImage(imageUrl) {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const filePath = urlParts.slice(-2).join('/'); // Get 'event-images/filename.ext'

      const { error } = await supabase.storage
        .from('images')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting image from Supabase:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Image deletion service error:', error);
      return false;
    }
  }

  /**
   * Validate video file
   * @param {Object} file - Multer file object
   * @returns {boolean} - Validation result
   */
  static validateVideoFile(file) {
    // Allowed video MIME types
    const allowedMimeTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo', // .avi
      'video/x-ms-wmv'   // .wmv
    ];

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Invalid video format. Allowed formats: MP4, MPEG, MOV, AVI, WMV' };
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      return { valid: false, error: 'Video file size too large. Maximum size is 50MB' };
    }

    return { valid: true };
  }

  /**
   * Validate image file
   * @param {Object} file - Multer file object
   * @returns {boolean} - Validation result
   */
  static validateImageFile(file) {
    // Allowed image MIME types
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Invalid image format. Allowed formats: JPEG, PNG, GIF, WebP' };
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return { valid: false, error: 'Image file size too large. Maximum size is 10MB' };
    }

    return { valid: true };
  }
}

module.exports = VideoUploadService;
