import React, { useState, useEffect } from 'react';

const AddEventModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    // CCTV Details - Now an array for multiple CCTVs
    cctvConfigs: [{
      cctvId: '',
      mountingHeight: '',
      verticalFOV: '',
      horizontalFOV: '',
      cameraTilt: ''
    }],
    videoSource: 'rtsp', // 'rtsp' or 'file'
    rtspLink: '',
    videoFile: null,
    // Event Image
    eventImage: null,
    // Organizers
    additionalOrganizers: [''] // Start with one empty field
  });

  const [errors, setErrors] = useState({});
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Reset status when modal opens
      setSubmitStatus(null);
      setIsLoading(false);
      
      const handleMouseMove = (e) => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      setFormData(prev => ({
        ...prev,
        [name]: files[0]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleCctvConfigChange = (index, field, value) => {
    const newCctvConfigs = [...formData.cctvConfigs];
    newCctvConfigs[index] = {
      ...newCctvConfigs[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      cctvConfigs: newCctvConfigs
    }));

    // Clear error when user starts typing
    const errorKey = `cctvConfigs.${index}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const addCctvConfig = () => {
    setFormData(prev => ({
      ...prev,
      cctvConfigs: [...prev.cctvConfigs, {
        cctvId: '',
        mountingHeight: '',
        verticalFOV: '',
        horizontalFOV: '',
        cameraTilt: ''
      }]
    }));
  };

  const removeCctvConfig = (index) => {
    if (formData.cctvConfigs.length > 1) {
      const newCctvConfigs = formData.cctvConfigs.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        cctvConfigs: newCctvConfigs
      }));
    }
  };

  const handleOrganizerChange = (index, value) => {
    const newOrganizers = [...formData.additionalOrganizers];
    newOrganizers[index] = value;
    setFormData(prev => ({
      ...prev,
      additionalOrganizers: newOrganizers
    }));
  };

  const addOrganizerField = () => {
    setFormData(prev => ({
      ...prev,
      additionalOrganizers: [...prev.additionalOrganizers, '']
    }));
  };

  const removeOrganizerField = (index) => {
    if (formData.additionalOrganizers.length > 1) {
      const newOrganizers = formData.additionalOrganizers.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        additionalOrganizers: newOrganizers
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Event title is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    
    // Validate each CCTV configuration
    formData.cctvConfigs.forEach((config, index) => {
      if (!config.cctvId.trim()) {
        newErrors[`cctvConfigs.${index}.cctvId`] = 'CCTV ID is required';
      }
      if (!config.mountingHeight) {
        newErrors[`cctvConfigs.${index}.mountingHeight`] = 'Mounting height is required';
      }
      if (!config.verticalFOV) {
        newErrors[`cctvConfigs.${index}.verticalFOV`] = 'Vertical FOV is required';
      }
      if (!config.horizontalFOV) {
        newErrors[`cctvConfigs.${index}.horizontalFOV`] = 'Horizontal FOV is required';
      }
      if (!config.cameraTilt && config.cameraTilt !== 0) {
        newErrors[`cctvConfigs.${index}.cameraTilt`] = 'Camera tilt is required';
      }
    });

    // Video source validation commented out for now
    /*
    if (formData.videoSource === 'rtsp' && !formData.rtspLink.trim()) {
      newErrors.rtspLink = 'RTSP link is required';
    }
    if (formData.videoSource === 'file' && !formData.videoFile) {
      newErrors.videoFile = 'Video file is required';
    }
    */

    // Validate dates
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) >= new Date(formData.endDate)) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      setIsLoading(true);
      setSubmitStatus(null);
      setErrors({});
      
      try {
        // Filter out empty organizer fields
        const cleanedOrganizers = formData.additionalOrganizers.filter(org => org.trim() !== '');
        
        const eventData = {
          ...formData,
          additionalOrganizers: cleanedOrganizers
        };
        
        await onSubmit(eventData);
        
        // Show success message
        setSubmitStatus('success');
        
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
          
          // Reset form
          setFormData({
            title: '',
            startDate: '',
            endDate: '',
            cctvConfigs: [{
              cctvId: '',
              mountingHeight: '',
              verticalFOV: '',
              horizontalFOV: '',
              cameraTilt: ''
            }],
            videoSource: 'rtsp',
            rtspLink: '',
            videoFile: null,
            eventImage: null,
            additionalOrganizers: ['']
          });
          setErrors({});
          setSubmitStatus(null);
          setIsLoading(false);
        }, 2000);
        
      } catch (error) {
        console.error('Error creating event:', error);
        setSubmitStatus('error');
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Create New Event</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Basic Event Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Event Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.title ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                  placeholder="Enter event title"
                />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event Image (Optional)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    name="eventImage"
                    onChange={handleInputChange}
                    accept="image/*"
                    className="hidden"
                    id="eventImageInput"
                  />
                  <label
                    htmlFor="eventImageInput"
                    className="flex items-center px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                    </svg>
                    Choose Image
                  </label>
                  {formData.eventImage && (
                    <span className="text-sm text-gray-400">
                      {formData.eventImage.name}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">Supported formats: JPEG, PNG, GIF, WebP (Max 10MB)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date & Time *
                </label>
                <input
                  type="datetime-local"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.startDate ? 'border-red-500' : 'border-white/10'} rounded-xl text-white focus:outline-none focus:border-white/20 transition-colors`}
                />
                {errors.startDate && <p className="text-red-400 text-sm mt-1">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date & Time *
                </label>
                <input
                  type="datetime-local"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.endDate ? 'border-red-500' : 'border-white/10'} rounded-xl text-white focus:outline-none focus:border-white/20 transition-colors`}
                />
                {errors.endDate && <p className="text-red-400 text-sm mt-1">{errors.endDate}</p>}
              </div>
            </div>

            {/* Event Image Upload - Moved to Event Information section above */}
          </div>

          {/* CCTV Details */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2 flex-1">
                CCTV Configuration
              </h3>
              <button
                type="button"
                onClick={addCctvConfig}
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add CCTV</span>
              </button>
            </div>
            
            {formData.cctvConfigs.map((config, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-white">
                    CCTV #{index + 1}
                  </h4>
                  {formData.cctvConfigs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCctvConfig(index)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      CCTV ID *
                    </label>
                    <input
                      type="text"
                      value={config.cctvId}
                      onChange={(e) => handleCctvConfigChange(index, 'cctvId', e.target.value)}
                      className={`w-full px-4 py-3 bg-white/5 border ${errors[`cctvConfigs.${index}.cctvId`] ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                      placeholder="e.g., CCTV001"
                    />
                    {errors[`cctvConfigs.${index}.cctvId`] && (
                      <p className="text-red-400 text-sm mt-1">{errors[`cctvConfigs.${index}.cctvId`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mount Height (m) *
                    </label>
                    <input
                      type="number"
                      value={config.mountingHeight}
                      onChange={(e) => handleCctvConfigChange(index, 'mountingHeight', e.target.value)}
                      step="0.1"
                      min="0"
                      className={`w-full px-4 py-3 bg-white/5 border ${errors[`cctvConfigs.${index}.mountingHeight`] ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                      placeholder="e.g., 3.5"
                    />
                    {errors[`cctvConfigs.${index}.mountingHeight`] && (
                      <p className="text-red-400 text-sm mt-1">{errors[`cctvConfigs.${index}.mountingHeight`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Vertical FOV (°) *
                    </label>
                    <input
                      type="number"
                      value={config.verticalFOV}
                      onChange={(e) => handleCctvConfigChange(index, 'verticalFOV', e.target.value)}
                      min="0"
                      max="180"
                      className={`w-full px-4 py-3 bg-white/5 border ${errors[`cctvConfigs.${index}.verticalFOV`] ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                      placeholder="e.g., 60"
                    />
                    {errors[`cctvConfigs.${index}.verticalFOV`] && (
                      <p className="text-red-400 text-sm mt-1">{errors[`cctvConfigs.${index}.verticalFOV`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Horizontal FOV (°) *
                    </label>
                    <input
                      type="number"
                      value={config.horizontalFOV}
                      onChange={(e) => handleCctvConfigChange(index, 'horizontalFOV', e.target.value)}
                      min="0"
                      max="180"
                      className={`w-full px-4 py-3 bg-white/5 border ${errors[`cctvConfigs.${index}.horizontalFOV`] ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                      placeholder="e.g., 90"
                    />
                    {errors[`cctvConfigs.${index}.horizontalFOV`] && (
                      <p className="text-red-400 text-sm mt-1">{errors[`cctvConfigs.${index}.horizontalFOV`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Camera Tilt (°) *
                    </label>
                    <input
                      type="number"
                      value={config.cameraTilt}
                      onChange={(e) => handleCctvConfigChange(index, 'cameraTilt', e.target.value)}
                      min="-90"
                      max="90"
                      className={`w-full px-4 py-3 bg-white/5 border ${errors[`cctvConfigs.${index}.cameraTilt`] ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                      placeholder="e.g., 15"
                    />
                    {errors[`cctvConfigs.${index}.cameraTilt`] && (
                      <p className="text-red-400 text-sm mt-1">{errors[`cctvConfigs.${index}.cameraTilt`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Video Source - Commented out for now */}
            {/*
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300">
                Video Source *
              </label>
              
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="videoSource"
                    value="rtsp"
                    checked={formData.videoSource === 'rtsp'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-white bg-white/5 border-white/10 focus:ring-white/20"
                  />
                  <span className="ml-2 text-gray-300">RTSP Stream</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="videoSource"
                    value="file"
                    checked={formData.videoSource === 'file'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-white bg-white/5 border-white/10 focus:ring-white/20"
                  />
                  <span className="ml-2 text-gray-300">Video File</span>
                </label>
              </div>

              {formData.videoSource === 'rtsp' ? (
                <div>
                  <input
                    type="url"
                    name="rtspLink"
                    value={formData.rtspLink}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 bg-white/5 border ${errors.rtspLink ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors`}
                    placeholder="rtsp://example.com:554/stream"
                  />
                  {errors.rtspLink && <p className="text-red-400 text-sm mt-1">{errors.rtspLink}</p>}
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    name="videoFile"
                    onChange={handleInputChange}
                    accept="video/*"
                    className={`w-full px-4 py-3 bg-white/5 border ${errors.videoFile ? 'border-red-500' : 'border-white/10'} rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-colors`}
                  />
                  {errors.videoFile && <p className="text-red-400 text-sm mt-1">{errors.videoFile}</p>}
                </div>
              )}
            </div>
            */}
          </div>

          {/* Additional Organizers */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Additional Organizers
            </h3>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Add other users who will have organizer access to this event. You will automatically become the primary organizer.
              </p>
              
              {formData.additionalOrganizers.map((organizer, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={organizer}
                    onChange={(e) => handleOrganizerChange(index, e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-white/20 transition-colors"
                    placeholder="Enter organizer username"
                  />
                  
                  {formData.additionalOrganizers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrganizerField(index)}
                      className="p-3 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={addOrganizerField}
                className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Another Organizer</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-white/10">
            {/* Status Messages */}
            {submitStatus && (
              <div className="flex-1">
                {submitStatus === 'success' && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">Event created successfully!</span>
                  </div>
                )}
                
                {submitStatus === 'error' && (
                  <div className="flex items-center space-x-2 text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Failed to create event. Please try again.</span>
                  </div>
                )}
              </div>
            )}
            
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isLoading}
              className="relative px-8 py-3 bg-gradient-to-r from-white to-gray-200 text-black font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:from-gray-100 hover:to-white hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating...</span>
                </span>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEventModal;
